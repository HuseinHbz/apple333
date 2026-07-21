import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { validateInventoryTestEnvironment } from './verify-inventory-test-environment.mjs';

const TEST_ADMIN_EMAIL = 'e2e-inventory-admin@example.test';
const TEST_ADMIN_PASSWORD = 'E2E-Inventory-Password-2026';
const ROLE_CODE = 'E2E_INVENTORY_MANAGER';
const PRODUCT_SLUG = 'e2e-inventory-iphone';
const SKU_CODE = 'E2E-INV-IPHONE-256-BLK';
const BULK_SKU_CODE = 'E2E-INV-BULK-CABLE';
const IMEI = '490154203237518';

const inventoryPermissions = [
  'dashboard.read',
  'products.read',
  'branches.read', 'branches.create', 'branches.update',
  'warehouses.read', 'warehouses.create', 'warehouses.update',
  'inventory.read', 'inventory.receive', 'inventory.adjust', 'inventory.transfer',
  'inventory.reserve', 'inventory.release', 'inventory.policy.update',
  'devices.read', 'devices.manage',
];

const branches = [
  { code: 'E2E-INV-A', name: 'E2E Inventory Branch A', city: 'Test City A', quantity: 10 },
  { code: 'E2E-INV-B', name: 'E2E Inventory Branch B', city: 'Test City B', quantity: 3 },
  { code: 'E2E-INV-C', name: 'E2E Inventory Branch C', city: 'Test City C', quantity: 1 },
  { code: 'E2E-INV-D', name: 'E2E Inventory Branch D', city: 'Test City D', quantity: 0 },
];

function validateEnvironment(environment = process.env) {
  const inventory = validateInventoryTestEnvironment(environment);
  const errors = [...inventory.errors];
  if (environment.APPLE333_E2E_TEST_DB !== '1') {
    errors.push('APPLE333_E2E_TEST_DB must be exactly "1".');
  }
  return { ok: errors.length === 0, errors };
}

async function seed(prisma) {
  const passwordHash = await hash(TEST_ADMIN_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: TEST_ADMIN_EMAIL },
    create: { email: TEST_ADMIN_EMAIL, name: 'E2E Inventory Administrator', status: 'ACTIVE' },
    update: { name: 'E2E Inventory Administrator', status: 'ACTIVE' },
    select: { id: true },
  });
  await prisma.adminUser.upsert({
    where: { userId: user.id },
    create: { userId: user.id, passwordHash, isActive: true },
    update: { passwordHash, isActive: true, branchId: null },
  });

  const permissionRows = await Promise.all(inventoryPermissions.map((code) => prisma.permission.upsert({
    where: { code },
    create: { code, group: 'inventory', description: 'Isolated E2E inventory permission.' },
    update: { group: 'inventory', description: 'Isolated E2E inventory permission.' },
    select: { id: true },
  })));
  const role = await prisma.role.upsert({
    where: { code: ROLE_CODE },
    create: { code: ROLE_CODE, name: 'E2E Inventory Manager', description: 'Isolated browser-test role.', isSystem: false },
    update: { name: 'E2E Inventory Manager', description: 'Isolated browser-test role.', isSystem: false },
    select: { id: true },
  });
  await prisma.rolePermission.createMany({
    data: permissionRows.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
    skipDuplicates: true,
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    create: { userId: user.id, roleId: role.id },
    update: {},
  });

  const category = await prisma.catalogCategory.upsert({
    where: { slug: 'e2e-inventory-category' },
    create: { slug: 'e2e-inventory-category', name: 'E2E Inventory Category', isActive: true },
    update: { name: 'E2E Inventory Category', isActive: true, deletedAt: null },
    select: { id: true },
  });
  const product = await prisma.catalogProduct.upsert({
    where: { slug: PRODUCT_SLUG },
    create: {
      categoryId: category.id,
      slug: PRODUCT_SLUG,
      name: 'Apple333 E2E Inventory iPhone',
      brand: 'Apple',
      summary: 'A controlled test product for Phase 06 inventory validation.',
      description: 'Only isolated E2E data; no operational inventory is created by this script.',
      status: 'PUBLISHED',
      publishedAt: new Date('2026-07-21T00:00:00.000Z'),
    },
    update: {
      categoryId: category.id,
      name: 'Apple333 E2E Inventory iPhone',
      brand: 'Apple',
      summary: 'A controlled test product for Phase 06 inventory validation.',
      description: 'Only isolated E2E data; no operational inventory is created by this script.',
      status: 'PUBLISHED',
      publishedAt: new Date('2026-07-21T00:00:00.000Z'),
      deletedAt: null,
    },
    select: { id: true },
  });
  const variant = await prisma.catalogVariant.upsert({
    where: { sku: SKU_CODE },
    create: {
      productId: product.id,
      sku: SKU_CODE,
      title: '256GB Black',
      color: 'Black',
      storage: '256GB',
      priceRials: 1_499_000_000n,
      isActive: true,
    },
    update: {
      productId: product.id,
      title: '256GB Black',
      color: 'Black',
      storage: '256GB',
      priceRials: 1_499_000_000n,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  const sku = await prisma.productSku.upsert({
    where: { code: SKU_CODE },
    create: { variantId: variant.id, code: SKU_CODE, priceRials: 1_499_000_000n, status: 'ACTIVE' },
    update: { variantId: variant.id, priceRials: 1_499_000_000n, status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });
  await prisma.inventorySkuPolicy.upsert({
    where: { skuId: sku.id },
    create: { skuId: sku.id, trackingMode: 'IMEI' },
    update: { trackingMode: 'IMEI' },
  });
  const bulkProduct = await prisma.catalogProduct.upsert({
    where: { slug: 'e2e-inventory-cable' },
    create: {
      categoryId: category.id,
      slug: 'e2e-inventory-cable',
      name: 'Apple333 E2E Inventory USB-C Cable',
      brand: 'Apple',
      status: 'PUBLISHED',
      publishedAt: new Date('2026-07-21T00:00:00.000Z'),
    },
    update: { categoryId: category.id, status: 'PUBLISHED', publishedAt: new Date('2026-07-21T00:00:00.000Z'), deletedAt: null },
    select: { id: true },
  });
  const bulkVariant = await prisma.catalogVariant.upsert({
    where: { sku: BULK_SKU_CODE },
    create: { productId: bulkProduct.id, sku: BULK_SKU_CODE, title: '1m White', priceRials: 49_000_000n, isActive: true },
    update: { productId: bulkProduct.id, title: '1m White', priceRials: 49_000_000n, isActive: true, deletedAt: null },
    select: { id: true },
  });
  const bulkSku = await prisma.productSku.upsert({
    where: { code: BULK_SKU_CODE },
    create: { variantId: bulkVariant.id, code: BULK_SKU_CODE, priceRials: 49_000_000n, status: 'ACTIVE' },
    update: { variantId: bulkVariant.id, priceRials: 49_000_000n, status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });

  for (const [index, branchFixture] of branches.entries()) {
    const branch = await prisma.branch.upsert({
      where: { code: branchFixture.code },
      create: {
        code: branchFixture.code,
        name: branchFixture.name,
        city: branchFixture.city,
        kind: 'STORE',
        status: 'ACTIVE',
        isActive: true,
        isPickupEnabled: true,
      },
      update: {
        name: branchFixture.name,
        city: branchFixture.city,
        status: 'ACTIVE',
        isActive: true,
        isPickupEnabled: true,
      },
      select: { id: true },
    });
    const warehouse = await prisma.warehouse.upsert({
      where: { branchId_code: { branchId: branch.id, code: `E2E-WH-${index + 1}` } },
      create: { branchId: branch.id, code: `E2E-WH-${index + 1}`, name: `E2E Warehouse ${index + 1}`, status: 'ACTIVE' },
      update: { name: `E2E Warehouse ${index + 1}`, status: 'ACTIVE' },
      select: { id: true },
    });
    const location = await prisma.inventoryLocation.upsert({
      where: { warehouseId_code: { warehouseId: warehouse.id, code: 'STORAGE' } },
      create: { warehouseId: warehouse.id, code: 'STORAGE', name: 'E2E Storage', type: 'STORAGE', status: 'ACTIVE' },
      update: { name: 'E2E Storage', type: 'STORAGE', status: 'ACTIVE' },
      select: { id: true },
    });
    await prisma.inventoryItem.upsert({
      where: { locationId_skuId: { locationId: location.id, skuId: sku.id } },
      create: {
        warehouseId: warehouse.id,
        locationId: location.id,
        skuId: sku.id,
        quantity: branchFixture.quantity,
        reservedQuantity: 0,
        availableQuantity: branchFixture.quantity,
      },
      update: { warehouseId: warehouse.id, quantity: branchFixture.quantity, reservedQuantity: 0, availableQuantity: branchFixture.quantity },
    });
    await prisma.inventoryItem.upsert({
      where: { locationId_skuId: { locationId: location.id, skuId: bulkSku.id } },
      create: { warehouseId: warehouse.id, locationId: location.id, skuId: bulkSku.id, quantity: 20, reservedQuantity: 0, availableQuantity: 20 },
      update: { warehouseId: warehouse.id, quantity: 20, reservedQuantity: 0, availableQuantity: 20 },
    });
    await prisma.branchInventory.upsert({
      where: { branchId_variantId: { branchId: branch.id, variantId: variant.id } },
      create: { branchId: branch.id, variantId: variant.id, onHand: branchFixture.quantity, reserved: 0 },
      update: { onHand: branchFixture.quantity, reserved: 0 },
    });
    await prisma.branchInventory.upsert({
      where: { branchId_variantId: { branchId: branch.id, variantId: bulkVariant.id } },
      create: { branchId: branch.id, variantId: bulkVariant.id, onHand: 20, reserved: 0 },
      update: { onHand: 20, reserved: 0 },
    });
    if (index === 0) {
      const item = await prisma.inventoryItem.findUniqueOrThrow({
        where: { locationId_skuId: { locationId: location.id, skuId: sku.id } },
        select: { id: true },
      });
      await prisma.deviceUnit.upsert({
        where: { imei: IMEI },
        create: { skuId: sku.id, inventoryItemId: item.id, imei: IMEI, status: 'AVAILABLE' },
        update: { skuId: sku.id, inventoryItemId: item.id, reservationId: null, status: 'AVAILABLE' },
      });
    }
  }
}

function isDirectExecution() {
  const invokedPath = process.argv[1];
  return Boolean(invokedPath) && resolve(invokedPath) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  const validation = validateEnvironment();
  if (!validation.ok) {
    console.error(`Inventory E2E fixture preflight failed: ${validation.errors.join(' ')}`);
    process.exitCode = 1;
  } else {
    const prisma = new PrismaClient({ datasources: { db: { url: process.env.INVENTORY_TEST_DATABASE_URL } } });
    try {
      await seed(prisma);
      console.log('Seeded isolated Phase 06 inventory E2E fixtures (branches=4, sku=1, device=1).');
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Inventory E2E fixture seeding failed.');
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
    }
  }
}
