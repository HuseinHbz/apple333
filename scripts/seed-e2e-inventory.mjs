import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import {
  E2E_INVENTORY_ACTORS,
  IMEI,
  INVENTORY_E2E_FIXTURES,
} from './inventory-e2e-fixtures.mjs';
import { validateInventoryTestEnvironment } from './verify-inventory-test-environment.mjs';

export {
  BRANCH_ROLE_CODE,
  BULK_SKU_CODE,
  E2E_INVENTORY_ACTORS,
  IMEI,
  INVENTORY_E2E_FIXTURES,
  PRODUCT_SLUG,
  ROLE_CODE,
  SERIAL_SKU_CODE,
  SKU_CODE,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
} from './inventory-e2e-fixtures.mjs';

const PUBLISHED_AT = new Date('2026-07-21T00:00:00.000Z');
const WARRANTY_EXPIRES_AT = new Date('2028-07-21T00:00:00.000Z');
const SEED_PREFIX = 'seed-phase06.1';
// Fixed bcrypt hash for TEST_ADMIN_PASSWORD. Keeping this stable makes a
// repeated seed idempotent instead of rewriting AdminUser on every run.
const TEST_ADMIN_PASSWORD_HASH = '$2b$10$PYyF5pJzlXHgoB4gv0k6musbta.ERNWEYHDJJJoCX17Aa7/DVdjfm';

const globalInventoryPermissions = [
  'dashboard.read',
  'products.read',
  'branches.read', 'branches.create', 'branches.update',
  'warehouses.read', 'warehouses.create', 'warehouses.update',
  'inventory.read', 'inventory.receive', 'inventory.adjust', 'inventory.transfer',
  'inventory.reserve', 'inventory.release', 'inventory.policy.update',
  'devices.read', 'devices.manage', 'audit.read', 'reports.read',
];

const branchInventoryPermissions = [
  'dashboard.read',
  'products.read',
  'branches.read',
  'warehouses.read',
  'inventory.read', 'inventory.receive', 'inventory.adjust', 'inventory.transfer',
  'inventory.reserve', 'inventory.release',
  'devices.read',
];

const readOnlyInventoryPermissions = [
  'dashboard.read',
  'products.read',
  'branches.read',
  'warehouses.read',
  'inventory.read',
  'devices.read',
];

const E2E_ROLE_DEFINITIONS = [
  { code: 'SUPER_ADMIN', name: 'E2E Super Admin', description: 'Isolated Phase 06.1.1 cross-branch inventory authority.', permissions: globalInventoryPermissions },
  { code: 'INVENTORY_MANAGER', name: 'E2E Inventory Manager', description: 'Isolated Phase 06.1.1 cross-branch inventory authority.', permissions: globalInventoryPermissions },
  { code: 'BRANCH_MANAGER', name: 'E2E Branch Manager', description: 'Isolated Phase 06.1.1 branch-scoped inventory authority.', permissions: branchInventoryPermissions },
  { code: 'READ_ONLY_USER', name: 'E2E Read-only User', description: 'Isolated Phase 06.1.1 inventory viewing authority.', permissions: readOnlyInventoryPermissions },
  { code: 'NO_PERMISSION_USER', name: 'E2E No-permission User', description: 'Isolated Phase 06.1.1 active administrative identity with no authority.', permissions: [] },
];

function validateEnvironment(environment = process.env) {
  const inventory = validateInventoryTestEnvironment(environment);
  const errors = [...inventory.errors];
  if (environment.APPLE333_E2E_TEST_DB !== '1') {
    errors.push('APPLE333_E2E_TEST_DB must be exactly "1".');
  }
  return { ok: errors.length === 0, errors };
}

function inventoryData(quantity, reservedQuantity = 0, availableQuantity = quantity - reservedQuantity) {
  return { quantity, reservedQuantity, availableQuantity, version: 1 };
}

async function upsertCatalogSku(prisma, categoryId, fixture, details = {}) {
  const product = await prisma.catalogProduct.upsert({
    where: { slug: fixture.productSlug },
    create: {
      categoryId,
      slug: fixture.productSlug,
      name: fixture.productName,
      brand: 'Apple',
      summary: details.summary ?? null,
      description: details.description ?? 'Only isolated E2E data; no operational inventory is created by this script.',
      status: 'PUBLISHED',
      publishedAt: PUBLISHED_AT,
    },
    update: {
      categoryId,
      name: fixture.productName,
      brand: 'Apple',
      summary: details.summary ?? null,
      description: details.description ?? 'Only isolated E2E data; no operational inventory is created by this script.',
      status: 'PUBLISHED',
      publishedAt: PUBLISHED_AT,
      deletedAt: null,
    },
    select: { id: true },
  });
  const variant = await prisma.catalogVariant.upsert({
    where: { sku: fixture.code },
    create: {
      productId: product.id,
      sku: fixture.code,
      title: fixture.variantTitle,
      color: details.color ?? null,
      storage: details.storage ?? null,
      priceRials: fixture.priceRials,
      isActive: true,
    },
    update: {
      productId: product.id,
      title: fixture.variantTitle,
      color: details.color ?? null,
      storage: details.storage ?? null,
      priceRials: fixture.priceRials,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  const sku = await prisma.productSku.upsert({
    where: { code: fixture.code },
    create: { variantId: variant.id, code: fixture.code, priceRials: fixture.priceRials, status: 'ACTIVE' },
    update: { variantId: variant.id, priceRials: fixture.priceRials, status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });
  await prisma.inventorySkuPolicy.upsert({
    where: { skuId: sku.id },
    create: { skuId: sku.id, trackingMode: fixture.trackingMode },
    update: { trackingMode: fixture.trackingMode },
  });
  return { sku, variant };
}

async function upsertBranchWarehouseAndLocations(prisma, fixture) {
  const branch = await prisma.branch.upsert({
    where: { code: fixture.code },
    create: {
      code: fixture.code,
      name: fixture.name,
      city: fixture.city,
      kind: 'STORE',
      status: 'ACTIVE',
      isActive: true,
      isPickupEnabled: true,
    },
    update: {
      name: fixture.name,
      city: fixture.city,
      status: 'ACTIVE',
      isActive: true,
      isPickupEnabled: true,
    },
    select: { id: true },
  });
  const warehouse = await prisma.warehouse.upsert({
    where: { branchId_code: { branchId: branch.id, code: fixture.warehouseCode } },
    create: { branchId: branch.id, code: fixture.warehouseCode, name: fixture.warehouseName, status: 'ACTIVE' },
    update: { name: fixture.warehouseName, status: 'ACTIVE' },
    select: { id: true },
  });
  const locations = Object.fromEntries(await Promise.all(INVENTORY_E2E_FIXTURES.locations.map(async (locationFixture) => {
    const location = await prisma.inventoryLocation.upsert({
      where: { warehouseId_code: { warehouseId: warehouse.id, code: locationFixture.code } },
      create: { warehouseId: warehouse.id, ...locationFixture },
      update: { name: locationFixture.name, type: locationFixture.type, status: locationFixture.status },
      select: { id: true },
    });
    return [locationFixture.code, location];
  })));
  return { branch, warehouse, locations };
}

async function upsertInventoryItem(prisma, input) {
  return prisma.inventoryItem.upsert({
    where: { locationId_skuId: { locationId: input.locationId, skuId: input.skuId } },
    create: { warehouseId: input.warehouseId, locationId: input.locationId, skuId: input.skuId, ...input.balance },
    update: { warehouseId: input.warehouseId, ...input.balance },
    select: { id: true },
  });
}

async function upsertBranchProjection(prisma, branchId, variantId, onHand, reserved) {
  await prisma.branchInventory.upsert({
    where: { branchId_variantId: { branchId, variantId } },
    create: { branchId, variantId, onHand, reserved },
    update: { onHand, reserved },
  });
}

async function upsertActorUsers(prisma, branchesByCode, passwordHash, roleIds) {
  const users = {};
  for (const [actorCode, fixture] of Object.entries(E2E_INVENTORY_ACTORS)) {
    const branch = fixture.branchCode === null ? null : branchesByCode[fixture.branchCode]?.branch;
    if (fixture.branchCode !== null && !branch) {
      throw new Error(`Missing isolated test branch for ${actorCode}.`);
    }
    const user = await prisma.user.upsert({
      where: { email: fixture.email },
      create: { email: fixture.email, name: fixture.name, status: 'ACTIVE' },
      update: { name: fixture.name, status: 'ACTIVE' },
      select: { id: true },
    });
    await prisma.adminUser.upsert({
      where: { userId: user.id },
      create: { userId: user.id, passwordHash, isActive: true, branchId: branch?.id ?? null },
      update: { passwordHash, isActive: true, branchId: branch?.id ?? null },
    });
    const roleId = roleIds[fixture.roleCode];
    if (!roleId) {
      throw new Error(`Missing isolated test role for ${actorCode}.`);
    }
    // The deterministic runtime persona must have exactly the declared role.
    // This affects only the isolated fixture user identified above.
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId } });
    users[actorCode] = user;
  }
  return users;
}

async function seedFixtures(prisma, passwordHash) {
  const permissionCodes = [...new Set(E2E_ROLE_DEFINITIONS.flatMap((role) => role.permissions))];
  const permissionRows = await Promise.all(permissionCodes.map((code) => prisma.permission.upsert({
    where: { code },
    create: { code, group: 'inventory', description: 'Isolated E2E inventory permission.' },
    update: { group: 'inventory', description: 'Isolated E2E inventory permission.' },
    select: { id: true, code: true },
  })));
  const permissionIds = new Map(permissionRows.map((permission) => [permission.code, permission.id]));
  const roleIds = {};
  for (const definition of E2E_ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { code: definition.code },
      create: { code: definition.code, name: definition.name, description: definition.description, isSystem: true },
      update: { name: definition.name, description: definition.description, isSystem: true },
      select: { id: true },
    });
    // This isolated test seed resets only its declared actor-role mappings.
    // Without this, an earlier broad mapping could survive via skipDuplicates.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (definition.permissions.length > 0) {
      const rolePermissionRows = definition.permissions.map((code) => {
        const permissionId = permissionIds.get(code);
        if (!permissionId) {
          throw new Error(`Missing isolated test permission for ${definition.code}: ${code}.`);
        }
        return { roleId: role.id, permissionId };
      });
      await prisma.rolePermission.createMany({
        data: rolePermissionRows,
      });
    }
    roleIds[definition.code] = role.id;
  }

  const category = await prisma.catalogCategory.upsert({
    where: { slug: 'e2e-inventory-category' },
    create: { slug: 'e2e-inventory-category', name: 'E2E Inventory Category', isActive: true },
    update: { name: 'E2E Inventory Category', isActive: true, deletedAt: null },
    select: { id: true },
  });
  const [imeiCatalog, serialCatalog, normalCatalog] = await Promise.all([
    upsertCatalogSku(prisma, category.id, INVENTORY_E2E_FIXTURES.skus.imei, {
      color: 'Black',
      storage: '256GB',
      summary: 'A controlled test product for Phase 06 inventory validation.',
    }),
    upsertCatalogSku(prisma, category.id, INVENTORY_E2E_FIXTURES.skus.serial, { color: 'White' }),
    upsertCatalogSku(prisma, category.id, INVENTORY_E2E_FIXTURES.skus.normal, { color: 'White', storage: '1m' }),
  ]);

  const seededBranches = await Promise.all(INVENTORY_E2E_FIXTURES.branches.map((fixture) => upsertBranchWarehouseAndLocations(prisma, fixture)));
  const branchesByCode = Object.fromEntries(seededBranches.map((entry, index) => [INVENTORY_E2E_FIXTURES.branches[index].code, entry]));

  const inactiveFixture = INVENTORY_E2E_FIXTURES.inactiveWarehouse;
  const inactiveBranch = branchesByCode[inactiveFixture.branchCode].branch;
  const inactiveWarehouse = await prisma.warehouse.upsert({
    where: { branchId_code: { branchId: inactiveBranch.id, code: inactiveFixture.code } },
    create: { branchId: inactiveBranch.id, code: inactiveFixture.code, name: inactiveFixture.name, status: inactiveFixture.status },
    update: { name: inactiveFixture.name, status: inactiveFixture.status },
    select: { id: true },
  });
  await prisma.inventoryLocation.upsert({
    where: { warehouseId_code: { warehouseId: inactiveWarehouse.id, code: inactiveFixture.location.code } },
    create: { warehouseId: inactiveWarehouse.id, ...inactiveFixture.location },
    update: { name: inactiveFixture.location.name, type: inactiveFixture.location.type, status: inactiveFixture.location.status },
  });

  const actorUsers = await upsertActorUsers(prisma, branchesByCode, passwordHash, roleIds);
  const globalUser = actorUsers.INVENTORY_MANAGER;

  const iphones = {
    'E2E-INV-A': inventoryData(3),
    'E2E-INV-B': inventoryData(2, 1),
    'E2E-INV-C': inventoryData(2),
    'E2E-INV-D': inventoryData(0),
  };
  const serials = {
    'E2E-INV-A': inventoryData(0),
    'E2E-INV-B': inventoryData(0),
    'E2E-INV-C': inventoryData(0),
    'E2E-INV-D': inventoryData(1),
  };

  const items = {};
  for (const fixture of INVENTORY_E2E_FIXTURES.branches) {
    const entry = branchesByCode[fixture.code];
    const storage = entry.locations.STORAGE;
    const damaged = entry.locations['Z-DAMAGED'];
    const iphoneBalance = iphones[fixture.code];
    const serialBalance = serials[fixture.code];
    const [iphoneItem, normalItem, serialItem] = await Promise.all([
      upsertInventoryItem(prisma, { warehouseId: entry.warehouse.id, locationId: storage.id, skuId: imeiCatalog.sku.id, balance: iphoneBalance }),
      upsertInventoryItem(prisma, { warehouseId: entry.warehouse.id, locationId: storage.id, skuId: normalCatalog.sku.id, balance: inventoryData(20) }),
      upsertInventoryItem(prisma, { warehouseId: entry.warehouse.id, locationId: storage.id, skuId: serialCatalog.sku.id, balance: serialBalance }),
    ]);
    const damagedIphoneItem = fixture.code === 'E2E-INV-C'
      ? await upsertInventoryItem(prisma, { warehouseId: entry.warehouse.id, locationId: damaged.id, skuId: imeiCatalog.sku.id, balance: inventoryData(1) })
      : null;
    await Promise.all([
      // BranchInventory is the sellable projection. The damaged unit remains
      // physical InventoryItem evidence but must never make the storefront
      // availability band more optimistic.
      upsertBranchProjection(prisma, entry.branch.id, imeiCatalog.variant.id, iphoneBalance.quantity, iphoneBalance.reservedQuantity),
      upsertBranchProjection(prisma, entry.branch.id, normalCatalog.variant.id, 20, 0),
      upsertBranchProjection(prisma, entry.branch.id, serialCatalog.variant.id, serialBalance.quantity, serialBalance.reservedQuantity),
    ]);
    items[fixture.code] = { iphone: iphoneItem, normal: normalItem, serial: serialItem, damagedIphone: damagedIphoneItem };
  }

  const reservation = await prisma.inventoryReservation.upsert({
    where: { idempotencyKey: `${SEED_PREFIX}-reservation-iphone-b-1` },
    create: {
      inventoryItemId: items['E2E-INV-B'].iphone.id,
      quantity: 1,
      status: 'ACTIVE',
      expiresAt: new Date('2028-07-22T00:00:00.000Z'),
      reference: 'Phase 06.1 seeded reserved IMEI',
      idempotencyKey: `${SEED_PREFIX}-reservation-iphone-b-1`,
      createdById: globalUser.id,
    },
    update: {
      inventoryItemId: items['E2E-INV-B'].iphone.id,
      quantity: 1,
      status: 'ACTIVE',
      expiresAt: new Date('2028-07-22T00:00:00.000Z'),
      reference: 'Phase 06.1 seeded reserved IMEI',
      createdById: globalUser.id,
    },
    select: { id: true },
  });

  const deviceFixtures = [
    { imei: IMEI, inventoryItemId: items['E2E-INV-A'].iphone.id, status: 'AVAILABLE', reservationId: null },
    { imei: '490154203237526', inventoryItemId: items['E2E-INV-A'].iphone.id, status: 'AVAILABLE', reservationId: null },
    { imei: '490154203237534', inventoryItemId: items['E2E-INV-A'].iphone.id, status: 'AVAILABLE', reservationId: null },
    { imei: '490154203237542', inventoryItemId: items['E2E-INV-B'].iphone.id, status: 'AVAILABLE', reservationId: null },
    { imei: '490154203237559', inventoryItemId: items['E2E-INV-B'].iphone.id, status: 'RESERVED', reservationId: reservation.id },
    { imei: '490154203237575', inventoryItemId: items['E2E-INV-C'].iphone.id, status: 'AVAILABLE', reservationId: null },
    { imei: '490154203237583', inventoryItemId: items['E2E-INV-C'].iphone.id, status: 'AVAILABLE', reservationId: null },
    { imei: '490154203237567', inventoryItemId: items['E2E-INV-C'].damagedIphone.id, status: 'DAMAGED', reservationId: null },
  ];
  await Promise.all(deviceFixtures.map((device) => prisma.deviceUnit.upsert({
    where: { imei: device.imei },
    create: { skuId: imeiCatalog.sku.id, warrantyExpiresAt: WARRANTY_EXPIRES_AT, ...device },
    update: { skuId: imeiCatalog.sku.id, warrantyExpiresAt: WARRANTY_EXPIRES_AT, ...device },
  })));
  await prisma.deviceUnit.upsert({
    where: { serialNumber: 'E2E-SERIAL-TRANSFERRED-0001' },
    create: {
      skuId: serialCatalog.sku.id,
      inventoryItemId: items['E2E-INV-D'].serial.id,
      serialNumber: 'E2E-SERIAL-TRANSFERRED-0001',
      status: 'AVAILABLE',
      warrantyExpiresAt: WARRANTY_EXPIRES_AT,
    },
    update: {
      skuId: serialCatalog.sku.id,
      inventoryItemId: items['E2E-INV-D'].serial.id,
      reservationId: null,
      status: 'AVAILABLE',
      warrantyExpiresAt: WARRANTY_EXPIRES_AT,
    },
  });

  await Promise.all([
    prisma.stockMovement.upsert({
      where: { idempotencyKey: `${SEED_PREFIX}-transfer-serial-a-to-d-1` },
      create: {
        skuId: serialCatalog.sku.id,
        fromLocationId: branchesByCode['E2E-INV-A'].locations.STORAGE.id,
        toLocationId: branchesByCode['E2E-INV-D'].locations.STORAGE.id,
        quantity: 1,
        type: 'TRANSFER',
        reference: 'Phase 06.1 seeded transferred serial device',
        idempotencyKey: `${SEED_PREFIX}-transfer-serial-a-to-d-1`,
        performedById: globalUser.id,
        metadata: { scenario: 'transferred-serial-device' },
      },
      update: {
        skuId: serialCatalog.sku.id,
        fromLocationId: branchesByCode['E2E-INV-A'].locations.STORAGE.id,
        toLocationId: branchesByCode['E2E-INV-D'].locations.STORAGE.id,
        quantity: 1,
        type: 'TRANSFER',
        adjustmentDirection: null,
        reference: 'Phase 06.1 seeded transferred serial device',
        performedById: globalUser.id,
        metadata: { scenario: 'transferred-serial-device' },
      },
    }),
    prisma.stockMovement.upsert({
      where: { idempotencyKey: `reservation:${SEED_PREFIX}-reservation-iphone-b-1` },
      create: {
        skuId: imeiCatalog.sku.id,
        fromLocationId: branchesByCode['E2E-INV-B'].locations.STORAGE.id,
        quantity: 1,
        type: 'SALE_RESERVED',
        adjustmentDirection: 'DECREASE',
        reference: 'Phase 06.1 seeded reserved IMEI',
        idempotencyKey: `reservation:${SEED_PREFIX}-reservation-iphone-b-1`,
        performedById: globalUser.id,
        metadata: { reservationId: reservation.id, scenario: 'reserved-imei-device' },
      },
      update: {
        skuId: imeiCatalog.sku.id,
        fromLocationId: branchesByCode['E2E-INV-B'].locations.STORAGE.id,
        toLocationId: null,
        quantity: 1,
        type: 'SALE_RESERVED',
        adjustmentDirection: 'DECREASE',
        reference: 'Phase 06.1 seeded reserved IMEI',
        performedById: globalUser.id,
        metadata: { reservationId: reservation.id, scenario: 'reserved-imei-device' },
      },
    }),
  ]);
}

/**
 * Seeds only an explicitly acknowledged, isolated Phase 06.1 test database.
 * The guard lives here as well as the CLI entrypoint so imported callers cannot
 * accidentally bypass test-environment validation.
 */
export async function seed(prisma, environment = process.env) {
  const validation = validateEnvironment(environment);
  if (!validation.ok) {
    throw new Error(`Inventory E2E fixture preflight failed: ${validation.errors.join(' ')}`);
  }
  await prisma.$transaction((transaction) => seedFixtures(transaction, TEST_ADMIN_PASSWORD_HASH));
}

function isDirectExecution() {
  const invokedPath = process.argv[1];
  return Boolean(invokedPath) && resolve(invokedPath) === fileURLToPath(import.meta.url);
}

async function runCli() {
  const validation = validateEnvironment();
  if (!validation.ok) {
    console.error(`Inventory E2E fixture preflight failed: ${validation.errors.join(' ')}`);
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({ datasources: { db: { url: process.env.INVENTORY_TEST_DATABASE_URL } } });
  try {
    await seed(prisma);
    console.log('Seeded isolated Phase 06.1 inventory E2E fixtures (branches=4, warehouses=5, sku=3, devices=9).');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Inventory E2E fixture seeding failed.');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (isDirectExecution()) {
  void runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Inventory E2E fixture seeding failed.');
    process.exitCode = 1;
  });
}
