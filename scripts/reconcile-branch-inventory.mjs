import { PrismaClient } from '@prisma/client';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateInventoryTestEnvironment } from './verify-inventory-test-environment.mjs';

function keyOf(record) {
  return `${record.branchId}\u001f${record.variantId}`;
}

function toTimestamp(value) {
  if (!value) return null;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function groupByKey(records) {
  const groups = new Map();
  for (const record of records) {
    const key = keyOf(record);
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  return groups;
}

/**
 * Read-only runtime counterpart of the typed reconciliation utility. The
 * canonical rows retain every physical InventoryItem branch/variant key, but
 * calculate onHand and reserved only from the sellable contract: active
 * STORAGE/PICKUP locations under active warehouses and branches. Receiving,
 * quarantine, and damaged quantities remain physical evidence and contribute
 * zero to BranchInventory's sellable projection. The command is deliberately
 * self-contained so it runs with Node alone and never loads application
 * services that could mutate inventory.
 */
export function reconcileBranchInventoryRows(canonicalRows, projectionRows) {
  const canonicalGroups = groupByKey(canonicalRows);
  const projectionGroups = groupByKey(projectionRows);
  const keys = new Set([...canonicalGroups.keys(), ...projectionGroups.keys()]);
  const drift = [];

  for (const key of [...keys].sort()) {
    const canonicalGroup = canonicalGroups.get(key) ?? [];
    const projectionGroup = projectionGroups.get(key) ?? [];
    const representative = canonicalGroup[0] ?? projectionGroup[0];
    if (!representative) continue;
    const coordinate = { branchId: representative.branchId, variantId: representative.variantId };
    if (canonicalGroup.length > 1) {
      drift.push({ kind: 'DUPLICATE_CANONICAL', ...coordinate, detail: `Canonical aggregate returned ${canonicalGroup.length} rows.` });
    }
    if (projectionGroup.length > 1) {
      drift.push({ kind: 'DUPLICATE_PROJECTION', ...coordinate, detail: `Legacy projection returned ${projectionGroup.length} rows.` });
    }

    const canonical = canonicalGroup[0];
    const projection = projectionGroup[0];
    if (!canonical && projection) {
      drift.push({ kind: 'MISSING_CANONICAL', ...coordinate, detail: 'Legacy projection row has no canonical inventory aggregate.' });
      continue;
    }
    if (canonical && !projection) {
      drift.push({ kind: 'MISSING_PROJECTION', ...coordinate, detail: 'Canonical inventory aggregate has no legacy projection row.' });
      drift.push({
        kind: 'SKU_DRIFT',
        ...coordinate,
        detail: `Legacy projection is missing canonical SKU identifiers: ${(canonical.skuIds ?? []).join(', ') || '(none)'}.`,
      });
      continue;
    }
    if (!canonical || !projection) continue;

    if (canonical.onHand !== projection.onHand) {
      drift.push({ kind: 'ON_HAND_DRIFT', ...coordinate, detail: `onHand canonical=${canonical.onHand}, projection=${projection.onHand}.` });
    }
    if (canonical.reserved !== projection.reserved) {
      drift.push({ kind: 'RESERVED_DRIFT', ...coordinate, detail: `reserved canonical=${canonical.reserved}, projection=${projection.reserved}.` });
    }
    const canonicalTimestamp = toTimestamp(canonical.updatedAt);
    const projectionTimestamp = toTimestamp(projection.updatedAt);
    if (canonicalTimestamp !== null && projectionTimestamp !== null && projectionTimestamp < canonicalTimestamp) {
      drift.push({ kind: 'STALE_PROJECTION', ...coordinate, detail: 'Legacy projection is older than canonical inventory.' });
    }
  }

  return {
    canonicalCount: canonicalRows.length,
    projectionCount: projectionRows.length,
    drift,
    isReconciled: drift.length === 0,
  };
}

function parseArguments(argumentsList) {
  const supplied = new Set(argumentsList.slice(2));
  const allowed = new Set(['--json', '--fail-on-drift']);
  for (const argument of supplied) {
    if (!allowed.has(argument)) throw new Error(`Unsupported argument: ${argument}`);
  }
  return { json: supplied.has('--json'), failOnDrift: supplied.has('--fail-on-drift') };
}

async function loadRows(prisma) {
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
      END), 0)::integer AS reserved,
      MAX(CASE
        WHEN location.type IN ('STORAGE', 'PICKUP')
          AND location.status = 'ACTIVE'
          AND warehouse.status = 'ACTIVE'
          AND branch.status = 'ACTIVE'
          AND branch."isActive" = TRUE
        THEN item."updatedAt"
        ELSE NULL
      END) AS "updatedAt",
      ARRAY_AGG(DISTINCT item."skuId" ORDER BY item."skuId") AS "skuIds"
    FROM "InventoryItem" AS item
    INNER JOIN "InventoryLocation" AS location ON location.id = item."locationId"
    INNER JOIN "Warehouse" AS warehouse ON warehouse.id = item."warehouseId" AND warehouse.id = location."warehouseId"
    INNER JOIN "Branch" AS branch ON branch.id = warehouse."branchId"
    INNER JOIN "ProductSku" AS sku ON sku.id = item."skuId"
    GROUP BY warehouse."branchId", sku."variantId"
    ORDER BY warehouse."branchId" ASC, sku."variantId" ASC
  `;
  const projectionRows = await prisma.$queryRaw`
    SELECT
      "branchId" AS "branchId",
      "variantId" AS "variantId",
      "onHand" AS "onHand",
      reserved,
      "updatedAt" AS "updatedAt"
    FROM "BranchInventory"
    ORDER BY "branchId" ASC, "variantId" ASC
  `;
  return { canonicalRows, projectionRows };
}

async function main() {
  const preflight = validateInventoryTestEnvironment(process.env);
  if (!preflight.ok) throw new Error(`Inventory reconciliation preflight failed: ${preflight.errors.join(' ')}`);
  const options = parseArguments(process.argv);
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.INVENTORY_TEST_DATABASE_URL } } });
  try {
    const { canonicalRows, projectionRows } = await loadRows(prisma);
    const result = reconcileBranchInventoryRows(canonicalRows, projectionRows);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`BranchInventory reconciliation: canonical=${result.canonicalCount}, projection=${result.projectionCount}, drift=${result.drift.length}.`);
      for (const entry of result.drift) console.log(`${entry.kind} ${entry.branchId}/${entry.variantId}: ${entry.detail}`);
    }
    if (options.failOnDrift && !result.isReconciled) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'BranchInventory reconciliation failed.');
    process.exitCode = 1;
  });
}
