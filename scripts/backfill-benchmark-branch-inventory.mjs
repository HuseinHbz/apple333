import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { validateInventoryTestEnvironment } from './verify-inventory-test-environment.mjs';

const BENCHMARK_PREFIX = 'inventory-benchmark-';
const INSERT_BATCH_SIZE = 1_000;

function keyOf(record) {
  return `${record.branchId}\u001f${record.variantId}`;
}

function runPrefix(runId) {
  return `${BENCHMARK_PREFIX}${runId}`;
}

function validRunId(value) {
  return /^[a-z0-9](?:[a-z0-9-]{6,38}[a-z0-9])?$/.test(value ?? '');
}

/**
 * This repair is deliberately separate from read-only reconciliation. It is
 * restricted to an explicitly named, disposable benchmark fixture and may
 * create only missing BranchInventory projection rows. It never updates a
 * physical InventoryItem or overwrites an existing projection.
 */
export function parseBenchmarkProjectionBackfillArguments(argumentsList = process.argv.slice(2)) {
  if (argumentsList.length === 1 && argumentsList[0] === '--help') return { help: true };

  const apply = argumentsList.includes('--apply');
  const runIdIndex = argumentsList.indexOf('--run-id');
  const allowed = apply
    ? argumentsList.length === 3 && runIdIndex >= 0
    : argumentsList.length === 2 && runIdIndex >= 0;
  if (!allowed || runIdIndex + 1 >= argumentsList.length) {
    throw new Error('Use --run-id <benchmark-run-id> [--apply], or use --help.');
  }

  const runId = argumentsList[runIdIndex + 1];
  if (!validRunId(runId)) {
    throw new Error('Benchmark run id must be 8-40 lowercase letters, digits, or hyphens.');
  }
  return { help: false, runId, apply };
}

export function planBenchmarkProjectionBackfill(canonicalRows, projectionRows) {
  const projections = new Map(projectionRows.map((row) => [keyOf(row), row]));
  const missing = [];
  const conflicts = [];

  for (const canonical of canonicalRows) {
    const projection = projections.get(keyOf(canonical));
    if (!projection) {
      missing.push({
        branchId: canonical.branchId,
        variantId: canonical.variantId,
        onHand: canonical.onHand,
        reserved: canonical.reserved,
      });
      continue;
    }
    if (projection.onHand !== canonical.onHand || projection.reserved !== canonical.reserved) {
      conflicts.push({
        branchId: canonical.branchId,
        variantId: canonical.variantId,
        canonical: { onHand: canonical.onHand, reserved: canonical.reserved },
        projection: { onHand: projection.onHand, reserved: projection.reserved },
      });
    }
  }

  return { missing, conflicts };
}

function splitIntoBatches(items, size = INSERT_BATCH_SIZE) {
  const batches = [];
  for (let offset = 0; offset < items.length; offset += size) batches.push(items.slice(offset, offset + size));
  return batches;
}

async function loadBenchmarkRows(prisma, prefix) {
  const branchPattern = `${prefix}-branch-%`;
  const variantPattern = `${prefix}-variant-%`;
  const canonicalRows = await prisma.$queryRaw`
    SELECT
      warehouse."branchId" AS "branchId",
      sku."variantId" AS "variantId",
      COALESCE(SUM(CASE
        WHEN location.type IN ('STORAGE', 'PICKUP')
          AND location.status = 'ACTIVE'
          AND warehouse.status = 'ACTIVE'
          AND branch.status = 'ACTIVE'
          AND branch."isActive" = TRUE
        THEN item.quantity
        ELSE 0
      END), 0)::integer AS "onHand",
      COALESCE(SUM(CASE
        WHEN location.type IN ('STORAGE', 'PICKUP')
          AND location.status = 'ACTIVE'
          AND warehouse.status = 'ACTIVE'
          AND branch.status = 'ACTIVE'
          AND branch."isActive" = TRUE
        THEN item."reservedQuantity"
        ELSE 0
      END), 0)::integer AS reserved
    FROM "InventoryItem" AS item
    INNER JOIN "InventoryLocation" AS location ON location.id = item."locationId"
    INNER JOIN "Warehouse" AS warehouse ON warehouse.id = item."warehouseId" AND warehouse.id = location."warehouseId"
    INNER JOIN "Branch" AS branch ON branch.id = warehouse."branchId"
    INNER JOIN "ProductSku" AS sku ON sku.id = item."skuId"
    WHERE warehouse."branchId" LIKE ${branchPattern}
      AND sku."variantId" LIKE ${variantPattern}
    GROUP BY warehouse."branchId", sku."variantId"
    ORDER BY warehouse."branchId" ASC, sku."variantId" ASC
  `;
  const projectionRows = await prisma.$queryRaw`
    SELECT
      "branchId" AS "branchId",
      "variantId" AS "variantId",
      "onHand" AS "onHand",
      reserved
    FROM "BranchInventory"
    WHERE "branchId" LIKE ${branchPattern}
      AND "variantId" LIKE ${variantPattern}
    ORDER BY "branchId" ASC, "variantId" ASC
  `;
  return { canonicalRows, projectionRows };
}

function usage() {
  console.log(`Phase 06.1.1 benchmark projection repair

Read-only preview:
  node scripts/backfill-benchmark-branch-inventory.mjs --run-id <benchmark-run-id>

Explicit local-test apply:
  INVENTORY_BENCHMARK_BACKFILL_ACKNOWLEDGED=1 node scripts/backfill-benchmark-branch-inventory.mjs --run-id <benchmark-run-id> --apply

The command only runs against the isolated Phase 06 test database. It creates
missing BranchInventory rows from active sellable physical inventory for the
named benchmark run. It never deletes records, updates physical inventory, or
overwrites an existing projection; a mismatch is reported as a conflict.`);
}

async function execute(options) {
  const preflight = validateInventoryTestEnvironment(process.env);
  if (!preflight.ok) throw new Error(`Benchmark projection backfill preflight failed: ${preflight.errors.join(' ')}`);
  if (options.apply && process.env.INVENTORY_BENCHMARK_BACKFILL_ACKNOWLEDGED !== '1') {
    throw new Error('Set INVENTORY_BENCHMARK_BACKFILL_ACKNOWLEDGED=1 before using --apply.');
  }

  const prisma = new PrismaClient({ datasources: { db: { url: process.env.INVENTORY_TEST_DATABASE_URL } } });
  try {
    const prefix = runPrefix(options.runId);
    const initial = await loadBenchmarkRows(prisma, prefix);
    if (initial.canonicalRows.length === 0) {
      throw new Error('No canonical inventory rows exist for the named benchmark run; no records were changed.');
    }
    const plan = planBenchmarkProjectionBackfill(initial.canonicalRows, initial.projectionRows);
    if (plan.conflicts.length > 0) {
      throw new Error(`Refusing to overwrite ${plan.conflicts.length} conflicting BranchInventory projection(s).`);
    }

    if (!options.apply || plan.missing.length === 0) {
      console.log(JSON.stringify({
        runId: options.runId,
        canonicalCount: initial.canonicalRows.length,
        existingProjectionCount: initial.projectionRows.length,
        missingProjectionCount: plan.missing.length,
        conflictCount: plan.conflicts.length,
        applied: false,
      }, null, 2));
      return;
    }

    const batches = splitIntoBatches(plan.missing);
    await prisma.$transaction(async (transaction) => {
      for (const batch of batches) {
        await transaction.branchInventory.createMany({ data: batch, skipDuplicates: true });
      }
    }, { maxWait: 10_000, timeout: 120_000 });

    const after = await loadBenchmarkRows(prisma, prefix);
    const verification = planBenchmarkProjectionBackfill(after.canonicalRows, after.projectionRows);
    if (verification.missing.length > 0 || verification.conflicts.length > 0) {
      throw new Error('Backfill verification failed; no physical inventory was changed.');
    }
    console.log(JSON.stringify({
      runId: options.runId,
      canonicalCount: after.canonicalRows.length,
      existingProjectionCount: initial.projectionRows.length,
      createdProjectionCount: plan.missing.length,
      finalProjectionCount: after.projectionRows.length,
      applied: true,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  try {
    const options = parseBenchmarkProjectionBackfillArguments();
    if (options.help) usage();
    else await execute(options);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Benchmark projection backfill failed.');
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  void main();
}
