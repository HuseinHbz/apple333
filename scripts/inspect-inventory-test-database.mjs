import { Prisma, PrismaClient } from '@prisma/client';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXPECTED_INVENTORY_TEST_DATABASE,
  EXPECTED_INVENTORY_TEST_USER,
  validateInventoryTestEnvironment,
} from './verify-inventory-test-environment.mjs';

const PHASE_06_MIGRATION = '20260721000000_phase_06_inventory_multi_branch';
const expectedApplicationTables = new Set(
  Prisma.dmmf.datamodel.models.map((model) => model.dbName ?? model.name),
);
const requiredPhase06Indexes = new Set([
  'InventoryItem_locationId_skuId_key',
  'InventoryItem_warehouseId_skuId_idx',
  'InventoryItem_skuId_availableQuantity_idx',
  'StockMovement_idempotencyKey_key',
  'StockMovement_skuId_createdAt_idx',
  'DeviceUnit_imei_key',
  'DeviceUnit_serialNumber_key',
  'InventoryReservation_idempotencyKey_key',
  'InventoryReservation_inventoryItemId_status_expiresAt_idx',
]);
const requiredPhase06ForeignKeys = new Set([
  'Warehouse_branchId_fkey',
  'InventoryLocation_warehouseId_fkey',
  'InventoryItem_locationId_warehouseId_fkey',
  'InventoryItem_skuId_fkey',
  'StockMovement_skuId_fkey',
  'StockMovement_fromLocationId_fkey',
  'StockMovement_toLocationId_fkey',
  'DeviceUnit_skuId_fkey',
  'DeviceUnit_inventoryItemId_fkey',
  'DeviceUnit_reservationId_fkey',
  'InventoryReservation_inventoryItemId_fkey',
]);
const requiredPhase06Checks = new Set([
  'InventoryItem_quantity_nonnegative_check',
  'InventoryItem_reserved_nonnegative_check',
  'InventoryItem_reserved_not_above_quantity_check',
  'InventoryItem_available_balance_check',
  'StockMovement_quantity_positive_check',
  'StockMovement_distinct_locations_check',
  'DeviceUnit_identifier_required_check',
  'InventoryReservation_quantity_positive_check',
]);
const requiredLegacyBranchInventoryColumns = new Set(['branchId', 'variantId', 'onHand', 'reserved', 'updatedAt']);

/**
 * PostgreSQL installs plpgsql in public by default. Its presence alone does
 * not mean an isolated database has application schema state.
 */
export function isExpectedPristinePublicObject(object) {
  return object?.kind === 'extension' && object?.name === 'plpgsql';
}

function expectationFromArguments(argumentsList) {
  const requested = argumentsList.slice(2).filter((argument) => argument.startsWith('--expect-'));
  if (requested.length !== 1 || !['--expect-empty', '--expect-migrated'].includes(requested[0])) {
    throw new Error('Use exactly one of --expect-empty or --expect-migrated.');
  }
  return requested[0] === '--expect-empty' ? 'empty' : 'migrated';
}

async function inspect() {
  const preflight = validateInventoryTestEnvironment(process.env);
  if (!preflight.ok) {
    throw new Error(`Inventory test environment preflight failed: ${preflight.errors.join(' ')}`);
  }
  const expectation = expectationFromArguments(process.argv);
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.INVENTORY_TEST_DATABASE_URL } } });

  try {
    const identityRows = await prisma.$queryRaw`
      SELECT
        current_database() AS database,
        current_user AS role,
        current_schema() AS schema,
        inet_server_addr()::text AS "serverAddress",
        inet_server_port() AS "serverPort",
        version() AS version
    `;
    const identity = identityRows[0];
    if (!identity
      || identity.database !== EXPECTED_INVENTORY_TEST_DATABASE
      || identity.role !== EXPECTED_INVENTORY_TEST_USER
      || identity.schema !== 'public') {
      throw new Error('Connected database identity does not match the isolated inventory test target.');
    }

    const publicObjects = await prisma.$queryRaw`
      SELECT object_kind AS kind, object_name AS name
      FROM (
        SELECT ('relation:' || c.relkind::text) AS object_kind, c.relname AS object_name
        FROM pg_catalog.pg_class AS c
        INNER JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f', 'c')
        UNION ALL
        SELECT ('type:' || t.typtype::text) AS object_kind, t.typname AS object_name
        FROM pg_catalog.pg_type AS t
        INNER JOIN pg_catalog.pg_namespace AS n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typtype IN ('e', 'd', 'r')
        UNION ALL
        SELECT ('routine:' || p.prokind::text) AS object_kind, p.proname AS object_name
        FROM pg_catalog.pg_proc AS p
        INNER JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
        UNION ALL
        SELECT 'extension' AS object_kind, e.extname AS object_name
        FROM pg_catalog.pg_extension AS e
        INNER JOIN pg_catalog.pg_namespace AS n ON n.oid = e.extnamespace
      ) AS public_schema_objects
      ORDER BY kind ASC, name ASC
    `;
    const unexpectedPublicObjects = publicObjects.filter((object) => !isExpectedPristinePublicObject(object));
    if (expectation === 'empty' && unexpectedPublicObjects.length !== 0) {
      throw new Error('Expected a pristine isolated inventory test database before migration; public schema objects already exist.');
    }

    const tables = await prisma.$queryRaw`
      SELECT table_name AS name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `;
    const tableNames = tables.map((row) => row.name);
    if (expectation === 'migrated') {
      const expectedTables = new Set([...expectedApplicationTables, '_prisma_migrations']);
      const missingTables = [...expectedTables].filter((table) => !tableNames.includes(table));
      const unexpectedTables = tableNames.filter((table) => !expectedTables.has(table));
      if (missingTables.length > 0 || unexpectedTables.length > 0) {
        throw new Error(`Migration verification failed; missing=${missingTables.length}, unexpected=${unexpectedTables.length}.`);
      }
      const migrations = await prisma.$queryRaw`
        SELECT migration_name AS name, checksum, finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt"
        FROM "_prisma_migrations"
        ORDER BY finished_at ASC NULLS LAST, migration_name ASC
      `;
      const phaseMigration = migrations.find((migration) => migration.name === PHASE_06_MIGRATION);
      if (!phaseMigration || !phaseMigration.checksum || !phaseMigration.finishedAt || phaseMigration.rolledBackAt) {
        throw new Error('Migration verification failed; the Phase 06 migration is not completed with a checksum.');
      }
      const unhealthyMigration = migrations.find((migration) => !migration.finishedAt || migration.rolledBackAt);
      if (unhealthyMigration) {
        throw new Error(`Migration verification failed; ${unhealthyMigration.name} is incomplete or rolled back.`);
      }

      const indexes = await prisma.$queryRaw`
        SELECT indexname AS name, indexdef AS definition
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY indexname ASC
      `;
      const indexNames = new Set(indexes.map((index) => index.name));
      const missingIndexes = [...requiredPhase06Indexes].filter((name) => !indexNames.has(name));
      if (missingIndexes.length > 0) {
        throw new Error(`Migration verification failed; missing Phase 06 indexes: ${missingIndexes.join(', ')}.`);
      }

      const constraints = await prisma.$queryRaw`
        SELECT
          constraint_row.conname AS name,
          constraint_row.contype AS type,
          relation.relname AS "tableName",
          pg_get_constraintdef(constraint_row.oid) AS definition
        FROM pg_constraint AS constraint_row
        INNER JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
        INNER JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
        ORDER BY relation.relname ASC, constraint_row.conname ASC
      `;
      const foreignKeys = new Set(constraints.filter((constraint) => constraint.type === 'f').map((constraint) => constraint.name));
      const checks = new Set(constraints.filter((constraint) => constraint.type === 'c').map((constraint) => constraint.name));
      const missingForeignKeys = [...requiredPhase06ForeignKeys].filter((name) => !foreignKeys.has(name));
      const missingChecks = [...requiredPhase06Checks].filter((name) => !checks.has(name));
      if (missingForeignKeys.length > 0 || missingChecks.length > 0) {
        throw new Error(`Migration verification failed; missing foreignKeys=${missingForeignKeys.join(', ') || 'none'}, checks=${missingChecks.join(', ') || 'none'}.`);
      }

      const legacyColumns = await prisma.$queryRaw`
        SELECT column_name AS name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'BranchInventory'
        ORDER BY ordinal_position ASC
      `;
      const legacyColumnNames = new Set(legacyColumns.map((column) => column.name));
      const missingLegacyColumns = [...requiredLegacyBranchInventoryColumns].filter((name) => !legacyColumnNames.has(name));
      if (missingLegacyColumns.length > 0) {
        throw new Error(`Migration verification failed; legacy BranchInventory compatibility columns are missing: ${missingLegacyColumns.join(', ')}.`);
      }
    }
    console.log(`Inventory test database verified: database=${identity.database}, role=${identity.role}, schema=${identity.schema}, server=${identity.serverAddress ?? 'unknown'}:${identity.serverPort ?? 'unknown'}, tables=${tableNames.length}.`);
  } finally {
    await prisma.$disconnect();
  }
}

const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  inspect().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Inventory test database inspection failed.');
    process.exitCode = 1;
  });
}
