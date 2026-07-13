import { PrismaClient } from "@prisma/client";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_PIM_TEST_DATABASE,
  EXPECTED_PIM_TEST_USER,
  validatePimTestEnvironment,
} from "./verify-pim-test-environment.mjs";

export const PIM_BENCHMARK_SCALES = Object.freeze([10_000, 100_000]);
export const PIM_BENCHMARK_MIGRATION =
  "20260713000000_phase_04_1_pim_activation";
export const PIM_BENCHMARK_API_BASE_URL = "http://127.0.0.1:3000";
export const PIM_BENCHMARK_HTTP_SAMPLE_COUNT = 5;

const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_EXPLAIN_RUNS = 5;
const DEFAULT_API_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_API_P95_THRESHOLD_MS = 3_000;
const MIN_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 1_000;
const MIN_EXPLAIN_RUNS = 3;
const MAX_EXPLAIN_RUNS = 9;
const MIN_API_REQUEST_TIMEOUT_MS = 250;
const MAX_API_REQUEST_TIMEOUT_MS = 30_000;
const MIN_API_P95_THRESHOLD_MS = 100;
const MAX_API_P95_THRESHOLD_MS = 30_000;
const MAX_API_RESPONSE_BYTES = 1_000_000;
const REQUIRED_TABLES = Object.freeze([
  "CatalogCategory",
  "CatalogProduct",
  "CatalogVariant",
  "ProductSku",
  "ProductWorkflowEvent",
  "_prisma_migrations",
]);

function stringValue(value) {
  return typeof value === "string" ? value : null;
}

function numberValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function recordValue(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

export function parseBoundedInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a whole number.`);

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

export function validatePimBenchmarkApiBaseUrl(value) {
  if (value === PIM_BENCHMARK_API_BASE_URL) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: [
      `PIM_BENCHMARK_API_BASE_URL must be exactly "${PIM_BENCHMARK_API_BASE_URL}".`,
    ],
  };
}

export function resolvePimBenchmarkApiOptions(environment = process.env) {
  const apiTarget = validatePimBenchmarkApiBaseUrl(
    environment.PIM_BENCHMARK_API_BASE_URL,
  );
  if (!apiTarget.ok) throw new Error(apiTarget.errors.join(" "));

  const requestTimeoutMs = parseBoundedInteger(
    environment.PIM_BENCHMARK_API_TIMEOUT_MS,
    DEFAULT_API_REQUEST_TIMEOUT_MS,
    MIN_API_REQUEST_TIMEOUT_MS,
    MAX_API_REQUEST_TIMEOUT_MS,
    "PIM_BENCHMARK_API_TIMEOUT_MS",
  );
  const p95ThresholdMs = parseBoundedInteger(
    environment.PIM_BENCHMARK_API_P95_MS,
    DEFAULT_API_P95_THRESHOLD_MS,
    MIN_API_P95_THRESHOLD_MS,
    MAX_API_P95_THRESHOLD_MS,
    "PIM_BENCHMARK_API_P95_MS",
  );
  if (p95ThresholdMs > requestTimeoutMs) {
    throw new Error(
      "PIM_BENCHMARK_API_P95_MS must be less than or equal to PIM_BENCHMARK_API_TIMEOUT_MS.",
    );
  }

  return {
    baseUrl: new URL(PIM_BENCHMARK_API_BASE_URL),
    requestTimeoutMs,
    p95ThresholdMs,
  };
}

export function validatePimBenchmarkEnvironment(environment = process.env) {
  const preflight = validatePimTestEnvironment(environment);
  const errors = [...preflight.errors];
  const runId = environment.PIM_BENCHMARK_RUN_ID;

  if (environment.PIM_BENCHMARK_ALLOW_SEED !== "1") {
    errors.push('PIM_BENCHMARK_ALLOW_SEED must be exactly "1".');
  }

  if (
    typeof runId !== "string" ||
    !/^[a-z0-9](?:[a-z0-9-]{6,38}[a-z0-9])?$/.test(runId)
  ) {
    errors.push(
      "PIM_BENCHMARK_RUN_ID must be 8-40 lowercase letters, digits, or hyphens and cannot start or end with a hyphen.",
    );
  }

  if (
    environment.DATABASE_URL &&
    environment.DATABASE_URL !== environment.PIM_TEST_DATABASE_URL
  ) {
    errors.push(
      "DATABASE_URL must be unset or exactly match PIM_TEST_DATABASE_URL for this benchmark.",
    );
  }

  try {
    parseBoundedInteger(
      environment.PIM_BENCHMARK_BATCH_SIZE,
      DEFAULT_BATCH_SIZE,
      MIN_BATCH_SIZE,
      MAX_BATCH_SIZE,
      "PIM_BENCHMARK_BATCH_SIZE",
    );
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : "PIM_BENCHMARK_BATCH_SIZE is invalid.",
    );
  }

  try {
    parseBoundedInteger(
      environment.PIM_BENCHMARK_EXPLAIN_RUNS,
      DEFAULT_EXPLAIN_RUNS,
      MIN_EXPLAIN_RUNS,
      MAX_EXPLAIN_RUNS,
      "PIM_BENCHMARK_EXPLAIN_RUNS",
    );
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : "PIM_BENCHMARK_EXPLAIN_RUNS is invalid.",
    );
  }

  try {
    resolvePimBenchmarkApiOptions(environment);
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : "PIM benchmark API options are invalid.",
    );
  }

  return { ok: errors.length === 0, errors };
}

export function parseBenchmarkArguments(argumentsList = process.argv.slice(2)) {
  if (argumentsList.length === 1 && argumentsList[0] === "--help")
    return { help: true, execute: false };
  if (argumentsList.length === 1 && argumentsList[0] === "--execute")
    return { help: false, execute: true };
  throw new Error(
    "Use exactly --execute after setting the guarded isolated benchmark environment. Use --help for details.",
  );
}

function benchmarkContext(runId) {
  const marker = `pim-benchmark:${runId}`;
  const prefix = `pim-benchmark-${runId}`;
  return {
    runId,
    marker,
    categoryId: `${prefix}-category`,
    categorySlug: `${prefix}-category`,
    categoryName: `PIM benchmark category ${runId}`,
    productId: (ordinal) =>
      `${prefix}-product-${String(ordinal).padStart(6, "0")}`,
    productSlug: (ordinal) => `${prefix}-${String(ordinal).padStart(6, "0")}`,
    variantId: (ordinal) =>
      `${prefix}-variant-${String(ordinal).padStart(6, "0")}`,
    skuCode: (ordinal) =>
      `PIMBENCH-${runId.toUpperCase()}-${String(ordinal).padStart(6, "0")}`,
  };
}

function usage() {
  console.log(
    `Phase 04.1 isolated PIM benchmark\n\nRequired environment:\n  NODE_ENV=test\n  APPLE333_PIM_TEST_DB=1\n  PIM_TEST_DATABASE_URL=postgresql://apple333_pim_test:<password>@127.0.0.1:55432/apple333_pim_test?schema=public\n  PIM_BENCHMARK_ALLOW_SEED=1\n  PIM_BENCHMARK_RUN_ID=<unique-8-to-40-char-lowercase-id>\n  PIM_BENCHMARK_API_BASE_URL=${PIM_BENCHMARK_API_BASE_URL}\n\nOptional:\n  PIM_BENCHMARK_BATCH_SIZE=100..1000 (default ${DEFAULT_BATCH_SIZE})\n  PIM_BENCHMARK_EXPLAIN_RUNS=3..9 (default ${DEFAULT_EXPLAIN_RUNS})\n  PIM_BENCHMARK_API_TIMEOUT_MS=${MIN_API_REQUEST_TIMEOUT_MS}..${MAX_API_REQUEST_TIMEOUT_MS} (default ${DEFAULT_API_REQUEST_TIMEOUT_MS})\n  PIM_BENCHMARK_API_P95_MS=${MIN_API_P95_THRESHOLD_MS}..${MAX_API_P95_THRESHOLD_MS} (default ${DEFAULT_API_P95_THRESHOLD_MS})\n\nThe command creates retained, run-marked fixtures only in the guarded test database. It never performs cleanup; dispose of the isolated database outside this harness. The public API must already be running at the exact guarded base URL.\n\nRun:\n  node scripts/benchmark-pim-catalog.mjs --execute`,
  );
}

async function assertIsolatedMigratedDatabase(prisma) {
  const identityRows = await prisma.$queryRaw`
    SELECT current_database() AS database, current_user AS role, current_schema() AS schema
  `;
  const identity = recordValue(identityRows[0]);
  if (
    !identity ||
    stringValue(identity.database) !== EXPECTED_PIM_TEST_DATABASE ||
    stringValue(identity.role) !== EXPECTED_PIM_TEST_USER ||
    stringValue(identity.schema) !== "public"
  ) {
    throw new Error(
      "Connected database identity does not match the isolated PIM benchmark target.",
    );
  }

  const tableRows = await prisma.$queryRaw`
    SELECT table_name AS name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `;
  const tableNames = new Set(
    tableRows.map((row) => stringValue(recordValue(row)?.name)).filter(Boolean),
  );
  const missingTables = REQUIRED_TABLES.filter((name) => !tableNames.has(name));
  if (missingTables.length > 0) {
    throw new Error(
      `Required Phase 04.1 tables are missing from the isolated database: ${missingTables.join(", ")}.`,
    );
  }

  const migrationRows = await prisma.$queryRaw`
    SELECT migration_name AS name, finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt"
    FROM "_prisma_migrations"
    WHERE migration_name = ${PIM_BENCHMARK_MIGRATION}
  `;
  const migration = recordValue(migrationRows[0]);
  if (!migration || !migration.finishedAt || migration.rolledBackAt) {
    throw new Error(
      "The completed Phase 04.1 migration is required before benchmark data can be seeded.",
    );
  }

  const versionRows = await prisma.$queryRaw`SHOW server_version`;
  const version =
    stringValue(recordValue(versionRows[0])?.server_version) ?? "unknown";
  console.log(
    `PIM benchmark target verified: database=${EXPECTED_PIM_TEST_DATABASE}, role=${EXPECTED_PIM_TEST_USER}, schema=public, PostgreSQL=${version}.`,
  );
}

async function assertUnusedRun(prisma, context) {
  const [products, categories, variants, skus] = await prisma.$transaction([
    prisma.catalogProduct.count({ where: { searchText: context.marker } }),
    prisma.catalogCategory.count({ where: { slug: context.categorySlug } }),
    prisma.catalogVariant.count({
      where: {
        sku: { startsWith: `PIMBENCH-${context.runId.toUpperCase()}-` },
      },
    }),
    prisma.productSku.count({
      where: {
        code: { startsWith: `PIMBENCH-${context.runId.toUpperCase()}-` },
      },
    }),
  ]);

  if (products > 0 || categories > 0 || variants > 0 || skus > 0) {
    throw new Error(
      "PIM_BENCHMARK_RUN_ID has already created fixture records or a partial run. Choose a new run id; this harness never mutates existing fixtures.",
    );
  }
}

async function createBenchmarkCategory(prisma, context) {
  await prisma.catalogCategory.create({
    data: {
      id: context.categoryId,
      slug: context.categorySlug,
      name: context.categoryName,
      description:
        "Retained Phase 04.1 isolated performance benchmark fixture.",
      sortOrder: 9_999,
      isActive: true,
    },
  });
}

async function createWorkflowHistoryFixture(prisma, context) {
  const productId = context.productId(1);
  await prisma.productWorkflowEvent.createMany({
    data: [
      {
        id: `${productId}-workflow-review`,
        productId,
        fromStatus: "DRAFT",
        toStatus: "REVIEW",
        revision: 2,
        note: context.marker,
      },
      {
        id: `${productId}-workflow-published`,
        productId,
        fromStatus: "REVIEW",
        toStatus: "PUBLISHED",
        revision: 3,
        note: context.marker,
      },
    ],
  });
}

function buildBatch(context, startOrdinal, size) {
  const publishedAtBase = Date.UTC(2026, 0, 1);
  const products = [];
  const variants = [];
  const skus = [];

  for (let offset = 0; offset < size; offset += 1) {
    const ordinal = startOrdinal + offset;
    const productId = context.productId(ordinal);
    const variantId = context.variantId(ordinal);
    const skuCode = context.skuCode(ordinal);
    const priceRials = BigInt(10_000_000 + (ordinal % 1_000_000));

    products.push({
      id: productId,
      categoryId: context.categoryId,
      slug: context.productSlug(ordinal),
      name: `PIM benchmark product ${ordinal}`,
      brand: "Apple333 Benchmark",
      status: "PUBLISHED",
      publishedAt: new Date(publishedAtBase + ordinal * 1_000),
      searchText: context.marker,
      isFeatured: ordinal % 20 === 0,
      featuredRank: ordinal % 20 === 0 ? ordinal : null,
      isNew: ordinal % 5 === 0,
      isOnSale: ordinal % 7 === 0,
    });
    variants.push({
      id: variantId,
      productId,
      sku: skuCode,
      title: `Benchmark variant ${ordinal}`,
      priceRials,
      isActive: true,
      sortOrder: 0,
    });
    skus.push({
      id: `${variantId}-sku`,
      variantId,
      code: skuCode,
      priceRials,
      status: "ACTIVE",
    });
  }

  return { products, variants, skus };
}

async function seedToScale(
  prisma,
  context,
  currentCount,
  targetCount,
  batchSize,
) {
  const startedAt = performance.now();
  let inserted = 0;

  for (
    let ordinal = currentCount + 1;
    ordinal <= targetCount;
    ordinal += batchSize
  ) {
    const size = Math.min(batchSize, targetCount - ordinal + 1);
    const batch = buildBatch(context, ordinal, size);
    await prisma.$transaction(
      async (transaction) => {
        await transaction.catalogProduct.createMany({ data: batch.products });
        await transaction.catalogVariant.createMany({ data: batch.variants });
        await transaction.productSku.createMany({ data: batch.skus });
      },
      { maxWait: 10_000, timeout: 60_000 },
    );
    inserted += size;

    const completed = currentCount + inserted;
    if (completed === targetCount || completed % 10_000 === 0) {
      console.log(
        `PIM benchmark fixture progress: products=${completed}/${targetCount}.`,
      );
    }
  }

  const persistedCount = await prisma.catalogProduct.count({
    where: { searchText: context.marker },
  });
  if (persistedCount !== targetCount) {
    throw new Error(
      `Benchmark fixture count mismatch: expected ${targetCount}, found ${persistedCount}. Existing records were left untouched.`,
    );
  }

  return {
    inserted,
    durationMs: Number((performance.now() - startedAt).toFixed(3)),
  };
}

async function refreshBenchmarkPlannerStatistics(prisma) {
  // Bulk inserts into a fresh disposable database do not necessarily give the
  // PostgreSQL planner representative statistics before the next query. This
  // touches no application record or schema; it refreshes statistics only for
  // the exact guarded benchmark tables.
  await prisma.$executeRaw`
    ANALYZE "CatalogCategory", "CatalogProduct", "CatalogVariant", "ProductSku", "ProductWorkflowEvent"
  `;
}

function parseExplainDocument(rows) {
  const row = recordValue(rows[0]);
  const queryPlan = row?.["QUERY PLAN"];
  const parsed =
    typeof queryPlan === "string" ? JSON.parse(queryPlan) : queryPlan;
  const document = Array.isArray(parsed)
    ? recordValue(parsed[0])
    : recordValue(parsed);
  if (!document || !recordValue(document.Plan)) {
    throw new Error("PostgreSQL did not return a JSON EXPLAIN plan.");
  }
  return document;
}

function collectIndexes(plan, results = []) {
  const node = recordValue(plan);
  if (!node) return results;
  const indexName = stringValue(node["Index Name"]);
  if (indexName) {
    const nodeType = stringValue(node["Node Type"]) ?? "unknown-node";
    const relation = stringValue(node["Relation Name"]) ?? "unknown-relation";
    results.push(`${nodeType}:${relation}:${indexName}`);
  }
  const children = Array.isArray(node.Plans) ? node.Plans : [];
  for (const child of children) collectIndexes(child, results);
  return results;
}

export function summarizeExplainRows(rows) {
  const document = parseExplainDocument(rows);
  const root = recordValue(document.Plan);
  return {
    planningMs: numberValue(document["Planning Time"]),
    executionMs: numberValue(document["Execution Time"]),
    rootNode: stringValue(root?.["Node Type"]) ?? "unknown",
    actualRows: numberValue(root?.["Actual Rows"]),
    plannedRows: numberValue(root?.["Plan Rows"]),
    sharedHitBlocks: numberValue(root?.["Shared Hit Blocks"]),
    sharedReadBlocks: numberValue(root?.["Shared Read Blocks"]),
    indexes: [...new Set(collectIndexes(root))].sort(),
  };
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * percentileValue) - 1),
  );
  return Number(sorted[index].toFixed(3));
}

function summarizeRuns(runs) {
  const execution = runs
    .map((run) => run.executionMs)
    .filter((value) => value !== null);
  const planning = runs
    .map((run) => run.planningMs)
    .filter((value) => value !== null);
  if (execution.length === 0 || planning.length === 0) {
    throw new Error(
      "EXPLAIN output did not include planning and execution timings.",
    );
  }
  const last = runs.at(-1);
  return {
    runs: runs.length,
    executionMs: {
      p50: percentile(execution, 0.5),
      p95: percentile(execution, 0.95),
    },
    planningMs: {
      p50: percentile(planning, 0.5),
      p95: percentile(planning, 0.95),
    },
    rootNode: last.rootNode,
    actualRows: last.actualRows,
    plannedRows: last.plannedRows,
    sharedHitBlocks: last.sharedHitBlocks,
    sharedReadBlocks: last.sharedReadBlocks,
    indexes: [...new Set(runs.flatMap((run) => run.indexes))].sort(),
  };
}

export function publicApiBenchmarkPaths(categorySlug, productSlug) {
  const listingPath = "/api/products?page=1&pageSize=24&sort=newest";
  return [
    { path: "public-listing", requestPath: listingPath },
    {
      path: "public-category-filtered-listing",
      requestPath: `${listingPath}&category=${encodeURIComponent(categorySlug)}`,
    },
    {
      path: "public-detail",
      requestPath: `/api/products/${encodeURIComponent(productSlug)}`,
    },
    { path: "public-category-list", requestPath: "/api/categories" },
  ];
}

function jsonType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

export function summarizePublicApiBody(bodyText, byteLength, contentType) {
  const summary = {
    bytes: byteLength,
    contentType: contentType?.toLowerCase().startsWith("application/json")
      ? "application/json"
      : "other",
    json: { valid: false, root: "unknown", success: null, data: null },
  };

  try {
    const parsed = JSON.parse(bodyText);
    const root = jsonType(parsed);
    const response = recordValue(parsed);
    const data = response?.data;
    const dataRecord = recordValue(data);
    summary.json = {
      valid: true,
      root,
      success: typeof response?.success === "boolean" ? response.success : null,
      data: dataRecord
        ? {
            type: "object",
            itemCount: Array.isArray(dataRecord.items)
              ? dataRecord.items.length
              : null,
            total: numberValue(dataRecord.total),
          }
        : {
            type: jsonType(data),
            itemCount: Array.isArray(data) ? data.length : null,
            total: null,
          },
    };
  } catch {
    // The evidence intentionally reports only safe shape metadata, never raw response content.
  }

  return summary;
}

async function readBoundedResponseBody(response) {
  const contentLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_API_RESPONSE_BYTES
  ) {
    throw new Error(
      "Public API response exceeds the benchmark body-size limit.",
    );
  }

  if (!response.body) return { bytes: new Uint8Array(), text: "" };

  const reader = response.body.getReader();
  const chunks = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_API_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error(
          "Public API response exceeds the benchmark body-size limit.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, text: new TextDecoder().decode(bytes) };
}

async function measurePublicApiRequest(apiOptions, endpoint) {
  const url = new URL(endpoint.requestPath, apiOptions.baseUrl);
  if (url.origin !== PIM_BENCHMARK_API_BASE_URL || url.protocol !== "http:") {
    throw new Error(
      "Public API benchmark URL escaped the guarded local target.",
    );
  }

  const startedAt = performance.now();
  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(apiOptions.requestTimeoutMs),
    });
  } catch {
    throw new Error(
      `Public API benchmark request failed or timed out for ${endpoint.path}.`,
    );
  }

  const body = await readBoundedResponseBody(response);
  return {
    durationMs: Number((performance.now() - startedAt).toFixed(3)),
    status: response.status,
    body: summarizePublicApiBody(
      body.text,
      body.bytes.byteLength,
      response.headers.get("content-type"),
    ),
  };
}

async function runPublicApiPath(apiOptions, endpoint) {
  const samples = [];
  for (let sample = 0; sample < PIM_BENCHMARK_HTTP_SAMPLE_COUNT; sample += 1) {
    samples.push(await measurePublicApiRequest(apiOptions, endpoint));
  }

  const statusCounts = Object.fromEntries(
    [...new Set(samples.map((sample) => sample.status))]
      .sort((left, right) => left - right)
      .map((status) => [
        String(status),
        samples.filter((sample) => sample.status === status).length,
      ]),
  );
  const latencies = samples.map((sample) => sample.durationMs);
  return {
    path: endpoint.path,
    requestPath: endpoint.requestPath,
    samples,
    latencyMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
    },
    status: {
      expected: 200,
      counts: statusCounts,
      allExpected: samples.every((sample) => sample.status === 200),
    },
  };
}

async function runPublicApiBenchmark(apiOptions, context) {
  const paths = publicApiBenchmarkPaths(
    context.categorySlug,
    context.productSlug(1),
  );
  const results = [];
  for (const path of paths)
    results.push(await runPublicApiPath(apiOptions, path));
  return results;
}

function apiBenchmarkViolations(scale, paths, p95ThresholdMs) {
  return paths.flatMap((path) => {
    const violations = [];
    if (!path.status.allExpected)
      violations.push(`${scale}:${path.path} returned non-200 status.`);
    if (path.latencyMs.p95 > p95ThresholdMs) {
      violations.push(
        `${scale}:${path.path} p95=${path.latencyMs.p95}ms exceeds ${p95ThresholdMs}ms.`,
      );
    }
    return violations;
  });
}

async function explainPublicListing(prisma) {
  return prisma.$queryRaw`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT p.id, p.slug, p.name, p."publishedAt"
    FROM "CatalogProduct" AS p
    INNER JOIN "CatalogCategory" AS c ON c.id = p."categoryId"
    WHERE p.status = 'PUBLISHED'
      AND p."deletedAt" IS NULL
      AND c."isActive" = true
      AND c."deletedAt" IS NULL
      AND EXISTS (
        SELECT 1
        FROM "CatalogVariant" AS v
        INNER JOIN "ProductSku" AS s ON s."variantId" = v.id
        WHERE v."productId" = p.id
          AND v."isActive" = true
          AND v."deletedAt" IS NULL
          AND s.status = 'ACTIVE'
          AND s."deletedAt" IS NULL
      )
    ORDER BY p."publishedAt" DESC NULLS LAST, p.name ASC
    LIMIT 24
  `;
}

async function explainCategoryFilteredListing(prisma, categoryId) {
  return prisma.$queryRaw`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT p.id, p.slug, p.name, p."publishedAt"
    FROM "CatalogProduct" AS p
    INNER JOIN "CatalogCategory" AS c ON c.id = p."categoryId"
    WHERE p."categoryId" = ${categoryId}
      AND p.status = 'PUBLISHED'
      AND p."deletedAt" IS NULL
      AND c."isActive" = true
      AND c."deletedAt" IS NULL
      AND EXISTS (
        SELECT 1
        FROM "CatalogVariant" AS v
        INNER JOIN "ProductSku" AS s ON s."variantId" = v.id
        WHERE v."productId" = p.id
          AND v."isActive" = true
          AND v."deletedAt" IS NULL
          AND s.status = 'ACTIVE'
          AND s."deletedAt" IS NULL
      )
    ORDER BY p."publishedAt" DESC NULLS LAST, p.name ASC
    LIMIT 24
  `;
}

async function explainPublicDetail(prisma, slug) {
  return prisma.$queryRaw`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT p.id, p.slug, p.name
    FROM "CatalogProduct" AS p
    INNER JOIN "CatalogCategory" AS c ON c.id = p."categoryId"
    WHERE p.slug = ${slug}
      AND p.status = 'PUBLISHED'
      AND p."deletedAt" IS NULL
      AND c."isActive" = true
      AND c."deletedAt" IS NULL
      AND EXISTS (
        SELECT 1
        FROM "CatalogVariant" AS v
        INNER JOIN "ProductSku" AS s ON s."variantId" = v.id
        WHERE v."productId" = p.id
          AND v."isActive" = true
          AND v."deletedAt" IS NULL
          AND s.status = 'ACTIVE'
          AND s."deletedAt" IS NULL
      )
    LIMIT 1
  `;
}

async function explainPublicCategories(prisma) {
  return prisma.$queryRaw`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT id, slug, name, description, "imageUrl"
    FROM "CatalogCategory"
    WHERE "isActive" = true AND "deletedAt" IS NULL
    ORDER BY "sortOrder" ASC, name ASC
  `;
}

async function explainImportSkuValidation(prisma, skuCode) {
  return prisma.$queryRaw`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT id, "variantId", code
    FROM "ProductSku"
    WHERE code = ${skuCode}
      AND status = 'ACTIVE'
      AND "deletedAt" IS NULL
    LIMIT 1
  `;
}

async function explainWorkflowHistory(prisma, productId) {
  return prisma.$queryRaw`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT id, "fromStatus", "toStatus", revision, "createdAt"
    FROM "ProductWorkflowEvent"
    WHERE "productId" = ${productId}
    ORDER BY "createdAt" ASC
  `;
}

async function runExplainPath(name, explain, explainRuns) {
  const runs = [];
  for (let run = 0; run < explainRuns; run += 1) {
    runs.push(summarizeExplainRows(await explain()));
  }
  return { path: name, ...summarizeRuns(runs) };
}

async function runScaleBenchmark(
  prisma,
  context,
  scale,
  explainRuns,
  seedResult,
  apiOptions,
) {
  // Plan measurements are deliberately serialized. Running independent
  // EXPLAIN ANALYZE paths concurrently makes their timing include avoidable
  // resource contention rather than the single-request path being measured.
  const paths = [
    await runExplainPath(
      "public-listing",
      () => explainPublicListing(prisma),
      explainRuns,
    ),
    await runExplainPath(
      "public-category-filtered-listing",
      () => explainCategoryFilteredListing(prisma, context.categoryId),
      explainRuns,
    ),
    await runExplainPath(
      "public-detail",
      () => explainPublicDetail(prisma, context.productSlug(1)),
      explainRuns,
    ),
    await runExplainPath(
      "public-category-list",
      () => explainPublicCategories(prisma),
      explainRuns,
    ),
    await runExplainPath(
      "import-sku-validation",
      () => explainImportSkuValidation(prisma, context.skuCode(scale)),
      explainRuns,
    ),
    await runExplainPath(
      "workflow-history",
      () => explainWorkflowHistory(prisma, context.productId(1)),
      explainRuns,
    ),
  ];
  const apiPaths = await runPublicApiBenchmark(apiOptions, context);
  const apiViolations = apiBenchmarkViolations(
    scale,
    apiPaths,
    apiOptions.p95ThresholdMs,
  );

  const evidence = {
    scale,
    seed: seedResult,
    paths,
    api: {
      baseUrl: PIM_BENCHMARK_API_BASE_URL,
      samplesPerPath: PIM_BENCHMARK_HTTP_SAMPLE_COUNT,
      timeoutMs: apiOptions.requestTimeoutMs,
      p95ThresholdMs: apiOptions.p95ThresholdMs,
      paths: apiPaths,
    },
  };
  console.log(`PIM_BENCHMARK_EVIDENCE ${JSON.stringify(evidence)}`);
  return apiViolations;
}

async function executeBenchmark(environment) {
  const runId = environment.PIM_BENCHMARK_RUN_ID;
  const context = benchmarkContext(runId);
  const batchSize = parseBoundedInteger(
    environment.PIM_BENCHMARK_BATCH_SIZE,
    DEFAULT_BATCH_SIZE,
    MIN_BATCH_SIZE,
    MAX_BATCH_SIZE,
    "PIM_BENCHMARK_BATCH_SIZE",
  );
  const explainRuns = parseBoundedInteger(
    environment.PIM_BENCHMARK_EXPLAIN_RUNS,
    DEFAULT_EXPLAIN_RUNS,
    MIN_EXPLAIN_RUNS,
    MAX_EXPLAIN_RUNS,
    "PIM_BENCHMARK_EXPLAIN_RUNS",
  );
  const apiOptions = resolvePimBenchmarkApiOptions(environment);
  const prisma = new PrismaClient({
    datasources: { db: { url: environment.PIM_TEST_DATABASE_URL } },
  });

  try {
    await assertIsolatedMigratedDatabase(prisma);
    await assertUnusedRun(prisma, context);
    await createBenchmarkCategory(prisma, context);

    let seeded = 0;
    let workflowFixtureCreated = false;
    const apiViolations = [];
    for (const scale of PIM_BENCHMARK_SCALES) {
      const seedResult = await seedToScale(
        prisma,
        context,
        seeded,
        scale,
        batchSize,
      );
      seeded = scale;
      if (!workflowFixtureCreated) {
        await createWorkflowHistoryFixture(prisma, context);
        workflowFixtureCreated = true;
      }
      await refreshBenchmarkPlannerStatistics(prisma);
      apiViolations.push(
        ...(await runScaleBenchmark(
          prisma,
          context,
          scale,
          explainRuns,
          seedResult,
          apiOptions,
        )),
      );
    }
    if (apiViolations.length > 0) {
      throw new Error(
        `PIM benchmark API quality gate failed: ${apiViolations.join(" ")}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

function isDirectExecution() {
  const invokedPath = process.argv[1];
  return (
    Boolean(invokedPath) &&
    resolve(invokedPath) === fileURLToPath(import.meta.url)
  );
}

if (isDirectExecution()) {
  try {
    const argumentsResult = parseBenchmarkArguments();
    if (argumentsResult.help) {
      usage();
    } else {
      const preflight = validatePimBenchmarkEnvironment(process.env);
      if (!preflight.ok) {
        throw new Error(
          `PIM benchmark environment preflight failed: ${preflight.errors.join(" ")}`,
        );
      }
      await executeBenchmark(process.env);
    }
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "PIM benchmark execution failed.",
    );
    process.exitCode = 1;
  }
}
