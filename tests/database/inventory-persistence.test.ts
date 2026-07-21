import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validateInventoryTestEnvironment } from '../../scripts/verify-inventory-test-environment.mjs';
import { PERMISSIONS, type SessionActor } from '@/server/security/permissions';
import type { AdminAuditContext } from '@/server/admin/types';

const preflight = validateInventoryTestEnvironment(process.env);
if (!preflight.ok || !process.env.INVENTORY_TEST_DATABASE_URL) {
  throw new Error(`Inventory database tests require the guarded isolated target: ${preflight.errors.join(' ')}`);
}

process.env.DATABASE_URL = process.env.INVENTORY_TEST_DATABASE_URL;

type Database = typeof import('@/server/db/prisma');
type Inventory = typeof import('@/server/services/inventory-service');

const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
const codeSuffix = suffix.toUpperCase();
const slugSuffix = suffix.toLowerCase();

let database: Database;
let inventory: Inventory;
let actorId: string;
let actor: SessionActor;
let categoryId: string;
let trackedSkuCode: string;
let untrackedSkuCode: string;
let branchOneId: string;
let branchTwoId: string;
let sourceLocationId: string;
let quarantineLocationId: string;
let destinationLocationId: string;
let sourceInventoryItemId: string;
let destinationInventoryItemId: string;
let deviceUnitId: string;
let reservationId: string;

function audit(action: string): AdminAuditContext {
  return {
    actorId,
    requestId: `inventory-db-${slugSuffix}-${action}`.slice(0, 128),
  };
}

async function createSku(input: Readonly<{ suffix: string; tracking: boolean }>): Promise<string> {
  const product = await database.prisma.catalogProduct.create({
    data: {
      slug: `inventory-${input.suffix.toLowerCase()}-${slugSuffix}`,
      name: `Inventory test ${input.suffix} ${suffix}`,
      categoryId,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
    select: { id: true },
  });
  const code = `INV-${input.suffix}-${codeSuffix}`;
  const variant = await database.prisma.catalogVariant.create({
    data: {
      productId: product.id,
      sku: code,
      title: `${input.suffix} variant`,
      priceRials: 1_000_000n,
    },
    select: { id: true },
  });
  await database.prisma.productSku.create({
    data: { variantId: variant.id, code, priceRials: 1_000_000n, status: 'ACTIVE' },
  });
  if (input.tracking) {
    await inventory.configureSkuTracking(actor, { sku: code, trackingMode: 'IMEI' }, audit(`tracking-${input.suffix}`));
  }
  return code;
}

describe.sequential('Phase 06 real PostgreSQL inventory persistence', () => {
  beforeAll(async () => {
    database = await import('@/server/db/prisma');
    inventory = await import('@/server/services/inventory-service');
    await database.prisma.$connect();

    const user = await database.prisma.user.create({
      data: { name: `Inventory DB test ${suffix}`, email: `inventory-db-${suffix}@example.test` },
      select: { id: true },
    });
    actorId = user.id;
    actor = {
      id: user.id,
      roleCodes: ['INVENTORY_MANAGER'],
      permissions: new Set(PERMISSIONS),
      isAdmin: true,
    };
    const category = await database.prisma.catalogCategory.create({
      data: { slug: `inventory-category-${slugSuffix}`, name: `Inventory category ${suffix}` },
      select: { id: true },
    });
    categoryId = category.id;

    const branchOne = await inventory.createBranch({
      code: `INV-A-${codeSuffix}`,
      name: `Inventory branch A ${suffix}`,
      kind: 'STORE',
      status: 'ACTIVE',
      isPickupEnabled: true,
    }, audit('branch-a'));
    const branchTwo = await inventory.createBranch({
      code: `INV-B-${codeSuffix}`,
      name: `Inventory branch B ${suffix}`,
      kind: 'STORE',
      status: 'ACTIVE',
      isPickupEnabled: true,
    }, audit('branch-b'));
    branchOneId = branchOne.id;
    branchTwoId = branchTwo.id;

    const sourceWarehouse = await inventory.createWarehouse(actor, {
      branchId: branchOne.id,
      code: `WH-A-${codeSuffix}`,
      name: 'Source warehouse',
      status: 'ACTIVE',
      locations: [
        { code: `STORAGE-A-${codeSuffix}`, name: 'Source storage', type: 'STORAGE', status: 'ACTIVE' },
        { code: `QUAR-A-${codeSuffix}`, name: 'Source quarantine', type: 'QUARANTINE', status: 'ACTIVE' },
      ],
    }, audit('warehouse-a'));
    const destinationWarehouse = await inventory.createWarehouse(actor, {
      branchId: branchTwo.id,
      code: `WH-B-${codeSuffix}`,
      name: 'Destination warehouse',
      status: 'ACTIVE',
      locations: [{ code: `STORAGE-B-${codeSuffix}`, name: 'Destination storage', type: 'STORAGE', status: 'ACTIVE' }],
    }, audit('warehouse-b'));
    sourceLocationId = sourceWarehouse.locations.find((location) => location.type === 'STORAGE')!.id;
    quarantineLocationId = sourceWarehouse.locations.find((location) => location.type === 'QUARANTINE')!.id;
    destinationLocationId = destinationWarehouse.locations[0]!.id;

    trackedSkuCode = await createSku({ suffix: 'TRACKED', tracking: true });
    untrackedSkuCode = await createSku({ suffix: 'BULK', tracking: false });
  });

  afterAll(async () => {
    await database.prisma.$disconnect();
  });

  it('persists branches, warehouses, and location ownership', async () => {
    const [branches, warehouses] = await Promise.all([
      inventory.listBranches(actor),
      inventory.listWarehouses(actor),
    ]);
    expect(branches.items.map((branch) => branch.id)).toEqual(expect.arrayContaining([branchOneId, branchTwoId]));
    expect(warehouses.items).toHaveLength(2);
    expect(warehouses.items.every((warehouse) => warehouse.locations.length >= 1)).toBe(true);
  });

  it('receives a tracked device, creates a movement, and redacts identifiers in audit evidence', async () => {
    const received = await inventory.receiveInventory(actor, {
      sku: trackedSkuCode,
      toLocationId: sourceLocationId,
      quantity: 1,
      reference: 'INVENTORY-DB-RECEIPT',
      idempotencyKey: `inventory-db-receive-${suffix}`,
      devices: [{ imei: '490154203237518' }],
    }, audit('receive-tracked'));
    sourceInventoryItemId = received.inventoryItem.id;
    expect(received).toMatchObject({ idempotent: false, movement: { type: 'PURCHASE', quantity: 1 } });

    const device = await database.prisma.deviceUnit.findFirstOrThrow({
      where: { inventoryItemId: sourceInventoryItemId },
      select: { id: true, imei: true, status: true },
    });
    deviceUnitId = device.id;
    expect(device).toMatchObject({ imei: '490154203237518', status: 'AVAILABLE' });

    const auditEntry = await database.prisma.auditLog.findFirstOrThrow({
      where: { action: 'inventory.stock.received', entityId: sourceInventoryItemId },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    });
    expect(JSON.stringify(auditEntry.metadata)).not.toContain('490154203237518');
  });

  it('rejects a duplicate IMEI atomically across the inventory platform', async () => {
    await expect(inventory.receiveInventory(actor, {
      sku: trackedSkuCode,
      toLocationId: sourceLocationId,
      quantity: 1,
      idempotencyKey: `inventory-db-duplicate-imei-${suffix}`,
      devices: [{ imei: '490154203237518' }],
    }, audit('receive-duplicate-imei'))).rejects.toMatchObject({ code: 'CONFLICT' });

    const count = await database.prisma.stockMovement.count({ where: { idempotencyKey: `inventory-db-duplicate-imei-${suffix}` } });
    expect(count).toBe(0);
  });

  it('moves a tracked device and its balance atomically between branches', async () => {
    const transfer = await inventory.transferInventory(actor, {
      sku: trackedSkuCode,
      fromLocationId: sourceLocationId,
      toLocationId: destinationLocationId,
      quantity: 1,
      deviceUnitIds: [deviceUnitId],
      idempotencyKey: `inventory-db-transfer-${suffix}`,
    }, audit('transfer-tracked'));
    destinationInventoryItemId = transfer.destination.id;
    expect(transfer).toMatchObject({ idempotent: false, source: { availableQuantity: 0 }, destination: { availableQuantity: 1 } });

    const device = await database.prisma.deviceUnit.findUniqueOrThrow({
      where: { id: deviceUnitId },
      select: { inventoryItemId: true, status: true, reservationId: true },
    });
    expect(device).toEqual({ inventoryItemId: destinationInventoryItemId, status: 'AVAILABLE', reservationId: null });
  });

  it('reserves and releases the exact tracked unit without creating an order or payment', async () => {
    const reserved = await inventory.reserveInventory(actor, {
      inventoryItemId: destinationInventoryItemId,
      quantity: 1,
      deviceUnitIds: [deviceUnitId],
      reference: 'TEMPORARY-HOLD',
      idempotencyKey: `inventory-db-reserve-${suffix}`,
    }, audit('reserve'));
    reservationId = reserved.id;
    expect(reserved).toMatchObject({ status: 'ACTIVE', idempotent: false });

    const duringReservation = await database.prisma.deviceUnit.findUniqueOrThrow({
      where: { id: deviceUnitId },
      select: { status: true, reservationId: true },
    });
    expect(duringReservation).toEqual({ status: 'RESERVED', reservationId });

    await expect(inventory.releaseInventoryReservation(actor, {
      reservationId,
      idempotencyKey: `inventory-db-release-${suffix}`,
    }, audit('release'))).resolves.toMatchObject({ id: reservationId, status: 'RELEASED', idempotent: false });

    const afterRelease = await database.prisma.deviceUnit.findUniqueOrThrow({
      where: { id: deviceUnitId },
      select: { status: true, reservationId: true },
    });
    expect(afterRelease).toEqual({ status: 'AVAILABLE', reservationId: null });
  });

  it('records a bulk adjustment through the movement ledger and rejects negative balances', async () => {
    await inventory.receiveInventory(actor, {
      sku: untrackedSkuCode,
      toLocationId: sourceLocationId,
      quantity: 4,
      idempotencyKey: `inventory-db-bulk-receive-${suffix}`,
    }, audit('receive-bulk'));
    const decreased = await inventory.adjustInventory(actor, {
      sku: untrackedSkuCode,
      locationId: sourceLocationId,
      quantity: 2,
      direction: 'DECREASE',
      reason: 'Verified count correction',
      idempotencyKey: `inventory-db-bulk-adjust-${suffix}`,
    }, audit('adjust-bulk'));
    expect(decreased.inventoryItem.availableQuantity).toBe(2);
    expect(decreased.movement).toMatchObject({ type: 'ADJUSTMENT', adjustmentDirection: 'DECREASE' });

    await expect(inventory.adjustInventory(actor, {
      sku: untrackedSkuCode,
      locationId: sourceLocationId,
      quantity: 3,
      direction: 'DECREASE',
      reason: 'Intentional invariant probe',
      idempotencyKey: `inventory-db-bulk-negative-${suffix}`,
    }, audit('adjust-negative'))).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('enforces database balance checks and branch-scoped authorization', async () => {
    const trackedSku = await database.prisma.productSku.findUniqueOrThrow({ where: { code: trackedSkuCode }, select: { id: true } });
    await expect(database.prisma.inventoryItem.create({
      data: {
        warehouseId: (await database.prisma.inventoryLocation.findUniqueOrThrow({ where: { id: quarantineLocationId }, select: { warehouseId: true } })).warehouseId,
        locationId: quarantineLocationId,
        skuId: trackedSku.id,
        quantity: 1,
        reservedQuantity: 2,
        availableQuantity: -1,
      },
    })).rejects.toBeDefined();

    const scopedActor: SessionActor = { ...actor, branchId: branchOneId };
    await expect(inventory.transferInventory(scopedActor, {
      sku: trackedSkuCode,
      fromLocationId: destinationLocationId,
      toLocationId: sourceLocationId,
      quantity: 1,
      deviceUnitIds: [deviceUnitId],
      idempotencyKey: `inventory-db-cross-branch-${suffix}`,
    }, audit('cross-branch'))).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(inventory.transferInventory(scopedActor, {
      sku: trackedSkuCode,
      fromLocationId: sourceLocationId,
      toLocationId: destinationLocationId,
      quantity: 1,
      deviceUnitIds: [deviceUnitId],
      idempotencyKey: `inventory-db-transfer-${suffix}`,
    }, audit('cross-branch-transfer-replay'))).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(inventory.reserveInventory(scopedActor, {
      inventoryItemId: destinationInventoryItemId,
      quantity: 1,
      deviceUnitIds: [deviceUnitId],
      idempotencyKey: `inventory-db-reserve-${suffix}`,
    }, audit('cross-branch-reservation-replay'))).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(inventory.releaseInventoryReservation(scopedActor, {
      reservationId,
      idempotencyKey: `inventory-db-release-${suffix}`,
    }, audit('cross-branch-release-replay'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects a new reservation when its location was deactivated', async () => {
    const bulkItem = await database.prisma.inventoryItem.findFirstOrThrow({
      where: { locationId: sourceLocationId, sku: { is: { code: untrackedSkuCode } } },
      select: { id: true },
    });
    await database.prisma.inventoryLocation.update({
      where: { id: sourceLocationId },
      data: { status: 'DISABLED' },
    });

    await expect(inventory.reserveInventory(actor, {
      inventoryItemId: bulkItem.id,
      quantity: 1,
      idempotencyKey: `inventory-db-disabled-reservation-${suffix}`,
    }, audit('disabled-location-reservation'))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('returns only availability bands to the public availability service', async () => {
    const availability = await inventory.inventoryAvailabilityBySku(trackedSkuCode);
    expect(availability).toMatchObject({ skuCode: trackedSkuCode, availability: 'LIMITED' });
    expect(availability.branches).toEqual(expect.arrayContaining([
      expect.objectContaining({ branchId: branchTwoId, availability: 'LIMITED' }),
    ]));
    expect(JSON.stringify(availability)).not.toContain('490154203237518');
  });
});
