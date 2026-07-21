import { PrismaClient } from '@prisma/client';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import {
  EXPECTED_INVENTORY_TEST_DATABASE,
  EXPECTED_INVENTORY_TEST_USER,
  validateInventoryTestEnvironment,
} from './verify-inventory-test-environment.mjs';

export const INVENTORY_BENCHMARK_SCALES = Object.freeze([10_000, 100_000]);
export const INVENTORY_BENCHMARK_API_BASE_URL = 'http://127.0.0.1:3000';
const REQUIRED_MIGRATION = '20260721000000_phase_06_inventory_multi_branch';
const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_SAMPLE_COUNT = 30;
const P95_TARGET_MS = 250;

function parseBoundedInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a whole number.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

export function parseInventoryBenchmarkArguments(argumentsList = process.argv.slice(2)) {
  if (argumentsList.length === 1 && argumentsList[0] === '--help') return { help: true };
  if (argumentsList.length === 3 && argumentsList[0] === '--execute' && argumentsList[1] === '--scale') {
    const scale = Number(argumentsList[2]);
    if (!INVENTORY_BENCHMARK_SCALES.includes(scale)) {
      throw new Error('--scale must be exactly 10000 or 100000.');
    }
    return { help: false, scale };
  }
  throw new Error('Use --execute --scale <10000|100000>, or use --help.');
}

export function validateInventoryBenchmarkEnvironment(environment = process.env) {
  const preflight = validateInventoryTestEnvironment(environment);
  const errors = [...preflight.errors];
  if (environment.INVENTORY_BENCHMARK_ALLOW_SEED !== '1') {
    errors.push('INVENTORY_BENCHMARK_ALLOW_SEED must be exactly "1".');
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{6,38}[a-z0-9])?$/.test(environment.INVENTORY_BENCHMARK_RUN_ID ?? '')) {
    errors.push('INVENTORY_BENCHMARK_RUN_ID must be 8-40 lowercase letters, digits, or hyphens.');
  }
  if (environment.DATABASE_URL && environment.DATABASE_URL !== environment.INVENTORY_TEST_DATABASE_URL) {
    errors.push('DATABASE_URL must be unset or exactly match INVENTORY_TEST_DATABASE_URL.');
  }
  if (environment.INVENTORY_BENCHMARK_API_BASE_URL !== INVENTORY_BENCHMARK_API_BASE_URL) {
    errors.push(`INVENTORY_BENCHMARK_API_BASE_URL must be exactly "${INVENTORY_BENCHMARK_API_BASE_URL}".`);
  }
  for (const [value, fallback, minimum, maximum, name] of [
    [environment.INVENTORY_BENCHMARK_BATCH_SIZE, DEFAULT_BATCH_SIZE, 100, 1_000, 'INVENTORY_BENCHMARK_BATCH_SIZE'],
    [environment.INVENTORY_BENCHMARK_SAMPLE_COUNT, DEFAULT_SAMPLE_COUNT, 30, 100, 'INVENTORY_BENCHMARK_SAMPLE_COUNT'],
    [environment.INVENTORY_BENCHMARK_P95_MS, P95_TARGET_MS, 10, 5_000, 'INVENTORY_BENCHMARK_P95_MS'],
  ]) {
    try {
      parseBoundedInteger(value, fallback, minimum, maximum, name);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${name} is invalid.`);
    }
  }
  return { ok: errors.length === 0, errors };
}

function benchmarkOptions(environment = process.env) {
  return {
    runId: environment.INVENTORY_BENCHMARK_RUN_ID,
    batchSize: parseBoundedInteger(environment.INVENTORY_BENCHMARK_BATCH_SIZE, DEFAULT_BATCH_SIZE, 100, 1_000, 'INVENTORY_BENCHMARK_BATCH_SIZE'),
    samples: parseBoundedInteger(environment.INVENTORY_BENCHMARK_SAMPLE_COUNT, DEFAULT_SAMPLE_COUNT, 30, 100, 'INVENTORY_BENCHMARK_SAMPLE_COUNT'),
    p95TargetMs: parseBoundedInteger(environment.INVENTORY_BENCHMARK_P95_MS, P95_TARGET_MS, 10, 5_000, 'INVENTORY_BENCHMARK_P95_MS'),
    apiBaseUrl: new URL(INVENTORY_BENCHMARK_API_BASE_URL),
  };
}

function contextFor(runId) {
  const prefix = `inventory-benchmark-${runId}`;
  const skuPrefix = `INVBENCH-${runId.toUpperCase()}-`;
  return {
    marker: `inventory-benchmark:${runId}`,
    prefix,
    skuPrefix,
    categoryId: `${prefix}-category`,
    categorySlug: `${prefix}-category`,
    productId: `${prefix}-product`,
    branchId: (index) => `${prefix}-branch-${index}`,
    warehouseId: (index) => `${prefix}-warehouse-${index}`,
    locationId: (index) => `${prefix}-location-${index}`,
    variantId: (ordinal) => `${prefix}-variant-${String(ordinal).padStart(6, '0')}`,
    skuId: (ordinal) => `${prefix}-sku-${String(ordinal).padStart(6, '0')}`,
    skuCode: (ordinal) => `${skuPrefix}${String(ordinal).padStart(6, '0')}`,
  };
}

function percentile(values, quantile) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1));
  return Number(sorted[index].toFixed(3));
}

function summarize(samples) {
  return {
    samples: samples.length,
    p50Ms: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    p99Ms: percentile(samples, 0.99),
    minMs: Number(Math.min(...samples).toFixed(3)),
    maxMs: Number(Math.max(...samples).toFixed(3)),
  };
}

async function timeSamples(callback, count) {
  await callback();
  const values = [];
  for (let index = 0; index < count; index += 1) {
    const startedAt = performance.now();
    await callback();
    values.push(performance.now() - startedAt);
  }
  return summarize(values);
}

async function assertIsolatedMigratedDatabase(prisma) {
  const identityRows = await prisma.$queryRaw`
    SELECT current_database() AS database, current_user AS role, current_schema() AS schema
  `;
  const identity = identityRows[0];
  if (!identity
    || identity.database !== EXPECTED_INVENTORY_TEST_DATABASE
    || identity.role !== EXPECTED_INVENTORY_TEST_USER
    || identity.schema !== 'public') {
    throw new Error('Connected database identity does not match the isolated inventory benchmark target.');
  }
  const migrationRows = await prisma.$queryRaw`
    SELECT migration_name AS name, finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt"
    FROM "_prisma_migrations"
    WHERE migration_name = ${REQUIRED_MIGRATION}
  `;
  const migration = migrationRows[0];
  if (!migration || !migration.finishedAt || migration.rolledBackAt) {
    throw new Error('The completed Phase 06 migration is required; this benchmark never runs migrations.');
  }
}

async function assertUnusedRun(prisma, context) {
  const [products, branches, skus] = await Promise.all([
    prisma.catalogProduct.count({ where: { searchText: context.marker } }),
    prisma.branch.count({ where: { code: { startsWith: `INVBENCH-${context.prefix.slice('inventory-benchmark-'.length).toUpperCase()}` } } }),
    prisma.productSku.count({ where: { code: { startsWith: context.skuPrefix } } }),
  ]);
  if (products !== 0 || branches !== 0 || skus !== 0) {
    throw new Error('This benchmark run id already has retained or partial data. Choose a new run id; no records were changed.');
  }
}

async function seedReferenceData(prisma, context) {
  await prisma.catalogCategory.create({
    data: { id: context.categoryId, slug: context.categorySlug, name: `Inventory benchmark ${context.prefix}`, isActive: true },
  });
  await prisma.catalogProduct.create({
    data: {
      id: context.productId,
      categoryId: context.categoryId,
      slug: `${context.prefix}-product`,
      name: `Inventory benchmark product ${context.prefix}`,
      brand: 'Apple333 Benchmark',
      status: 'PUBLISHED',
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      searchText: context.marker,
    },
  });
  const branches = [1, 2, 3, 4].map((index) => ({
    id: context.branchId(index), code: `INVBENCH-${context.prefix.slice('inventory-benchmark-'.length).toUpperCase()}-${index}`,
    name: `Inventory benchmark branch ${index}`, kind: 'STORE', status: 'ACTIVE', isActive: true, isPickupEnabled: true,
  }));
  const warehouses = [1, 2, 3, 4].map((index) => ({
    id: context.warehouseId(index), branchId: context.branchId(index), code: 'BENCH', name: `Benchmark warehouse ${index}`, status: 'ACTIVE',
  }));
  const locations = [1, 2, 3, 4].map((index) => ({
    id: context.locationId(index), warehouseId: context.warehouseId(index), code: 'STORAGE', name: `Benchmark storage ${index}`, type: 'STORAGE', status: 'ACTIVE',
  }));
  await prisma.$transaction(async (transaction) => {
    await transaction.branch.createMany({ data: branches });
    await transaction.warehouse.createMany({ data: warehouses });
    await transaction.inventoryLocation.createMany({ data: locations });
  });
}

function buildBatch(context, startOrdinal, size) {
  const variants = [];
  const skus = [];
  const balances = [];
  for (let offset = 0; offset < size; offset += 1) {
    const ordinal = startOrdinal + offset;
    const variantId = context.variantId(ordinal);
    const skuId = context.skuId(ordinal);
    const price = BigInt(10_000_000 + ordinal);
    variants.push({ id: variantId, productId: context.productId, sku: context.skuCode(ordinal), title: `Benchmark variant ${ordinal}`, priceRials: price, isActive: true, sortOrder: 0 });
    skus.push({ id: skuId, variantId, code: context.skuCode(ordinal), priceRials: price, status: 'ACTIVE' });
    for (let branchIndex = 1; branchIndex <= 4; branchIndex += 1) {
      const quantity = (ordinal + branchIndex) % 7 + 1;
      balances.push({
        id: `${context.prefix}-item-${branchIndex}-${String(ordinal).padStart(6, '0')}`,
        warehouseId: context.warehouseId(branchIndex),
        locationId: context.locationId(branchIndex),
        skuId,
        quantity,
        reservedQuantity: 0,
        availableQuantity: quantity,
      });
    }
  }
  return { variants, skus, balances };
}

async function seedScale(prisma, context, scale, batchSize) {
  const startedAt = performance.now();
  for (let ordinal = 1; ordinal <= scale; ordinal += batchSize) {
    const size = Math.min(batchSize, scale - ordinal + 1);
    const batch = buildBatch(context, ordinal, size);
    await prisma.$transaction(async (transaction) => {
      await transaction.catalogVariant.createMany({ data: batch.variants });
      await transaction.productSku.createMany({ data: batch.skus });
      await transaction.inventoryItem.createMany({ data: batch.balances });
    }, { maxWait: 10_000, timeout: 60_000 });
    const completed = ordinal + size - 1;
    if (completed === scale || completed % 10_000 === 0) console.log(`Inventory benchmark fixture progress: skus=${completed}/${scale}.`);
  }
  const [skuCount, balanceCount] = await Promise.all([
    prisma.productSku.count({ where: { code: { startsWith: context.skuPrefix } } }),
    prisma.inventoryItem.count({ where: { skuId: { startsWith: `${context.prefix}-sku-` } } }),
  ]);
  if (skuCount !== scale || balanceCount !== scale * 4) {
    throw new Error(`Benchmark fixture count mismatch: expected skus=${scale}, balances=${scale * 4}; found skus=${skuCount}, balances=${balanceCount}.`);
  }
  return Number((performance.now() - startedAt).toFixed(3));
}

async function explain(prisma, sql, values) {
  const rows = await prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, ...values);
  const document = rows[0]?.['QUERY PLAN'];
  const parsed = typeof document === 'string' ? JSON.parse(document) : document;
  const report = Array.isArray(parsed) ? parsed[0] : parsed;
  return {
    planningMs: Number(report?.['Planning Time'] ?? 0),
    executionMs: Number(report?.['Execution Time'] ?? 0),
    rootNode: report?.Plan?.['Node Type'] ?? 'unknown',
  };
}

async function httpAvailabilitySamples(baseUrl, skuCode, samples) {
  const url = new URL(`/api/inventory/${encodeURIComponent(skuCode)}/availability`, baseUrl);
  return timeSamples(async () => {
    const response = await fetch(url, { headers: { 'x-request-id': `inventory-benchmark-${crypto.randomUUID()}` } });
    if (!response.ok) throw new Error(`Availability API returned HTTP ${response.status}.`);
    const body = await response.json();
    if (!body?.success || body?.data?.skuCode !== skuCode) throw new Error('Availability API returned an unexpected response shape.');
  }, samples);
}

function usage() {
  console.log(`Phase 06 isolated inventory benchmark

Required environment:
  NODE_ENV=test
  APPLE333_INVENTORY_TEST_DB=1
  APPLE333_E2E_TEST_DB=1 (only if the local app shares the same test target)
  INVENTORY_TEST_DATABASE_URL=postgresql://apple333_inventory_test:<password>@127.0.0.1:55433/apple333_inventory_test?schema=public
  INVENTORY_BENCHMARK_ALLOW_SEED=1
  INVENTORY_BENCHMARK_RUN_ID=<new-unique-id>
  INVENTORY_BENCHMARK_API_BASE_URL=${INVENTORY_BENCHMARK_API_BASE_URL}

Optional: INVENTORY_BENCHMARK_BATCH_SIZE=100..1000, INVENTORY_BENCHMARK_SAMPLE_COUNT=30..100, INVENTORY_BENCHMARK_P95_MS=10..5000.

The target must be a migrated, dedicated, loopback-only test database and a local app using that exact database must already be running on port 3000. The harness never creates databases, runs migrations, deletes records, changes existing benchmark records, or contacts production.

Run once per scale with a new run id:
  node scripts/benchmark-inventory.mjs --execute --scale 10000
  node scripts/benchmark-inventory.mjs --execute --scale 100000`);
}

async function execute(scale) {
  const validation = validateInventoryBenchmarkEnvironment(process.env);
  if (!validation.ok) throw new Error(`Inventory benchmark preflight failed: ${validation.errors.join(' ')}`);
  const options = benchmarkOptions();
  const context = contextFor(options.runId);
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.INVENTORY_TEST_DATABASE_URL } } });
  try {
    await assertIsolatedMigratedDatabase(prisma);
    await assertUnusedRun(prisma, context);
    await seedReferenceData(prisma, context);
    const seedDurationMs = await seedScale(prisma, context, scale, options.batchSize);
    await prisma.$executeRaw`ANALYZE "InventoryItem", "InventoryLocation", "Warehouse", "Branch", "ProductSku", "CatalogVariant"`;
    const targetOrdinal = Math.max(1, Math.floor(scale / 2));
    const targetSkuId = context.skuId(targetOrdinal);
    const targetSkuCode = context.skuCode(targetOrdinal);

    const metrics = {
      inventoryLookup: await timeSamples(() => prisma.inventoryItem.findMany({ where: { skuId: targetSkuId }, select: { id: true, availableQuantity: true } }), options.samples),
      branchStockQuery: await timeSamples(() => prisma.inventoryItem.findMany({ where: { warehouseId: context.warehouseId(1), skuId: targetSkuId }, select: { id: true, availableQuantity: true } }), options.samples),
      availabilityQuery: await timeSamples(() => prisma.inventoryItem.findMany({
        where: { skuId: targetSkuId, availableQuantity: { gt: 0 }, location: { is: { status: 'ACTIVE', warehouse: { is: { status: 'ACTIVE', branch: { is: { status: 'ACTIVE' } } } } } } },
        select: { availableQuantity: true },
      }), options.samples),
      availabilityApi: await httpAvailabilitySamples(options.apiBaseUrl, targetSkuCode, options.samples),
    };
    const plans = {
      inventoryLookup: await explain(prisma, 'SELECT "id", "availableQuantity" FROM "InventoryItem" WHERE "skuId" = $1', [targetSkuId]),
      branchStockQuery: await explain(prisma, 'SELECT "id", "availableQuantity" FROM "InventoryItem" WHERE "warehouseId" = $1 AND "skuId" = $2', [context.warehouseId(1), targetSkuId]),
      availabilityQuery: await explain(prisma, 'SELECT "id", "availableQuantity" FROM "InventoryItem" WHERE "skuId" = $1 AND "availableQuantity" > 0', [targetSkuId]),
    };
    const failures = Object.entries(metrics).filter(([, metric]) => metric.p95Ms > options.p95TargetMs);
    const evidence = { scale, samples: options.samples, p95TargetMs: options.p95TargetMs, seedDurationMs, metrics, plans, passed: failures.length === 0 };
    console.log(JSON.stringify(evidence, null, 2));
    if (failures.length > 0) throw new Error(`Inventory benchmark p95 target failed for: ${failures.map(([name]) => name).join(', ')}.`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  try {
    const argumentsValue = parseInventoryBenchmarkArguments();
    if (argumentsValue.help) usage();
    else await execute(argumentsValue.scale);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Inventory benchmark failed.');
    process.exitCode = 1;
  }
}

function isDirectExecution() {
  const invokedPath = process.argv[1];
  return Boolean(invokedPath) && resolve(invokedPath) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) void main();
