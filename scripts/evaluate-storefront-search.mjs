import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { validatePimTestEnvironment } from './verify-pim-test-environment.mjs';

const TERM_PATTERN = /^[\p{L}\p{N}\s-]{2,80}$/u;

/**
 * This evaluator is read-only. It accepts only the already guarded PIM test
 * database and runs EXPLAIN ANALYZE to produce search-index evidence.
 */
export function validateStorefrontSearchEvaluationEnvironment(environment = process.env) {
  const base = validatePimTestEnvironment(environment);
  const errors = [...base.errors];
  if (environment.STOREFRONT_SEARCH_EVALUATION_ALLOW_READ !== '1') {
    errors.push('STOREFRONT_SEARCH_EVALUATION_ALLOW_READ must be exactly "1".');
  }
  if (environment.DATABASE_URL && environment.DATABASE_URL !== environment.PIM_TEST_DATABASE_URL) {
    errors.push('DATABASE_URL must be unset or exactly equal to PIM_TEST_DATABASE_URL.');
  }
  const term = environment.STOREFRONT_SEARCH_EVALUATION_TERM ?? 'iphone';
  if (!TERM_PATTERN.test(term.trim())) {
    errors.push('STOREFRONT_SEARCH_EVALUATION_TERM must contain 2-80 letters, digits, spaces, or hyphens.');
  }
  return { ok: errors.length === 0, errors, term: term.trim() };
}

function record(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
}

function asNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function collectIndexes(plan, indexes = []) {
  const node = record(plan);
  if (!node) return indexes;
  if (typeof node['Index Name'] === 'string') indexes.push(node['Index Name']);
  const children = Array.isArray(node.Plans) ? node.Plans : [];
  for (const child of children) collectIndexes(child, indexes);
  return indexes;
}

export function summarizeExplain(rows) {
  const first = record(rows[0]);
  const raw = first?.['QUERY PLAN'];
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const document = Array.isArray(parsed) ? record(parsed[0]) : record(parsed);
  const plan = record(document?.Plan);
  if (!document || !plan) throw new Error('PostgreSQL did not return a JSON EXPLAIN plan.');
  return {
    executionMs: asNumber(document['Execution Time']),
    planningMs: asNumber(document['Planning Time']),
    rootNode: typeof plan['Node Type'] === 'string' ? plan['Node Type'] : 'unknown',
    indexes: [...new Set(collectIndexes(plan))].sort(),
  };
}

async function evaluate(prisma, term) {
  const extensions = await prisma.$queryRaw`
    SELECT extname
    FROM pg_extension
    WHERE extname IN ('pg_trgm', 'unaccent')
    ORDER BY extname ASC
  `;
  const indexes = await prisma.$queryRaw`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'CatalogProduct'
    ORDER BY indexname ASC
  `;
  const likePattern = `%${term}%`;
  const contains = summarizeExplain(await prisma.$queryRaw`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT p.id, p.slug, p.name
    FROM "CatalogProduct" AS p
    WHERE p.status = 'PUBLISHED'
      AND p."deletedAt" IS NULL
      AND (
        p.name ILIKE ${likePattern}
        OR p.brand ILIKE ${likePattern}
        OR p.summary ILIKE ${likePattern}
        OR p.slug ILIKE ${likePattern}
      )
    ORDER BY p."publishedAt" DESC NULLS LAST, p.name ASC
    LIMIT 24
  `);
  const fullText = summarizeExplain(await prisma.$queryRaw`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT p.id, p.slug, p.name
    FROM "CatalogProduct" AS p
    WHERE p.status = 'PUBLISHED'
      AND p."deletedAt" IS NULL
      AND to_tsvector('simple', concat_ws(' ', p.name, p.brand, p.summary, p."searchText"))
        @@ websearch_to_tsquery('simple', ${term})
    ORDER BY p."publishedAt" DESC NULLS LAST, p.name ASC
    LIMIT 24
  `);
  const extensionNames = extensions
    .flatMap((row) => {
      const value = record(row)?.extname;
      return typeof value === 'string' ? [value] : [];
    });
  const trigram = extensionNames.includes('pg_trgm')
    ? summarizeExplain(await prisma.$queryRaw`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT p.id, p.slug, p.name
      FROM "CatalogProduct" AS p
      WHERE p.status = 'PUBLISHED'
        AND p."deletedAt" IS NULL
        AND p.name % ${term}
      ORDER BY similarity(p.name, ${term}) DESC, p."publishedAt" DESC NULLS LAST
      LIMIT 24
    `)
    : null;
  return {
    term,
    extensions: extensionNames,
    catalogProductIndexes: indexes.flatMap((row) => {
      const name = record(row)?.indexname;
      return typeof name === 'string' ? [name] : [];
    }),
    contains,
    fullText,
    trigram,
  };
}

function isDirectExecution() {
  const invokedPath = process.argv[1];
  return Boolean(invokedPath) && resolve(invokedPath) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  const validation = validateStorefrontSearchEvaluationEnvironment();
  if (!validation.ok) {
    console.error(`Storefront search evaluation preflight failed: ${validation.errors.join(' ')}`);
    process.exitCode = 1;
  } else {
    const prisma = new PrismaClient({ datasources: { db: { url: process.env.PIM_TEST_DATABASE_URL } } });
    try {
      const evidence = await evaluate(prisma, validation.term);
      console.log(`STOREFRONT_SEARCH_EVALUATION ${JSON.stringify(evidence)}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Storefront search evaluation failed.');
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
    }
  }
}
