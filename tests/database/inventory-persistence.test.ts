import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validateInventoryTestEnvironment } from '../../scripts/verify-inventory-test-environment.mjs';
import { PERMISSIONS, type Permission, type SessionActor } from '@/server/security/permissions';
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
// A 14-digit TAC/serial fixture is accepted by the inventory validator and is
// unique for every suite invocation, so reruns never collide with retained
// disposable-test records.
const trackedImei = `49${suffix.replace(/\D/g, '').slice(-12).padStart(12, '0')}`;

let database: Database;
let inventory: Inventory;
let actorId: string;
let branchManagerId: string;
let actor: SessionActor;
let categoryId: string;
let trackedSkuCode: string;
let untrackedSkuCode: string;
let branchOneId: string;
let branchTwoId: string;
let sourceWarehouseId: string;
let sourceLocationId: string;
let quarantineLocationId: string;
let destinationLocationId: string;
let sourceInventoryItemId: string;
let destinationInventoryItemId: string;
let deviceUnitId: string;
let reservationId: string;

const branchManagerPermissions: readonly Permission[] = [
  'dashboard.read',
  'products.read',
  'branches.read',
  'warehouses.read',
  'inventory.read',
  'inventory.receive',
  'inventory.adjust',
  'inventory.transfer',
  'inventory.reserve',
  'inventory.release',
  'devices.read',
];

function audit(action: string): AdminAuditContext {
  return auditFor(actorId, action);
}

function auditFor(auditActorId: string, action: string): AdminAuditContext {
  return {
    actorId: auditActorId,
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
    const branchManager = await database.prisma.user.create({
      data: { name: `Inventory branch manager ${suffix}`, email: `inventory-branch-manager-${suffix}@example.test` },
      select: { id: true },
    });
    branchManagerId = branchManager.id;
    const category = await database.prisma.catalogCategory.create({
      data: { slug: `inventory-category-${slugSuffix}`, name: `Inventory category ${suffix}` },
      select: { id: true },
    });
    categoryId = category.id;

    const branchOne = await inventory.createBranch(actor, {
      code: `INV-A-${codeSuffix}`,
      name: `Inventory branch A ${suffix}`,
      kind: 'STORE',
      status: 'ACTIVE',
      isPickupEnabled: true,
    }, audit('branch-a'));
    const branchTwo = await inventory.createBranch(actor, {
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
    sourceWarehouseId = sourceWarehouse.id;
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
    const [branches, sourceWarehouses, destinationWarehouses] = await Promise.all([
      inventory.listBranches(actor),
      inventory.listWarehouses(actor, 1, 25, branchOneId),
      inventory.listWarehouses(actor, 1, 25, branchTwoId),
    ]);
    const warehouses = [...sourceWarehouses.items, ...destinationWarehouses.items];

    expect(branches.items.map((branch) => branch.id)).toEqual(expect.arrayContaining([branchOneId, branchTwoId]));
    expect(sourceWarehouses.items).toHaveLength(1);
    expect(destinationWarehouses.items).toHaveLength(1);
    expect(warehouses).toHaveLength(2);
    expect(warehouses.every((warehouse) => warehouse.locations.length >= 1)).toBe(true);
  });

  it('receives a tracked device, creates a movement, and redacts identifiers in audit evidence', async () => {
    const received = await inventory.receiveInventory(actor, {
      sku: trackedSkuCode,
      toLocationId: sourceLocationId,
      quantity: 1,
      reference: 'INVENTORY-DB-RECEIPT',
      idempotencyKey: `inventory-db-receive-${suffix}`,
      devices: [{ imei: trackedImei }],
    }, audit('receive-tracked'));
    sourceInventoryItemId = received.inventoryItem.id;
    expect(received).toMatchObject({ idempotent: false, movement: { type: 'PURCHASE', quantity: 1 } });

    const trackedSku = await database.prisma.productSku.findUniqueOrThrow({ where: { code: trackedSkuCode }, select: { variantId: true } });
    await expect(database.prisma.branchInventory.findUnique({
      where: { branchId_variantId: { branchId: branchOneId, variantId: trackedSku.variantId } },
      select: { onHand: true, reserved: true },
    })).resolves.toEqual({ onHand: 1, reserved: 0 });

    const device = await database.prisma.deviceUnit.findFirstOrThrow({
      where: { inventoryItemId: sourceInventoryItemId },
      select: { id: true, imei: true, status: true },
    });
    deviceUnitId = device.id;
    expect(device).toMatchObject({ imei: trackedImei, status: 'AVAILABLE' });

    const auditEntry = await database.prisma.auditLog.findFirstOrThrow({
      where: { action: 'inventory.stock.received', entityId: sourceInventoryItemId },
      orderBy: { createdAt: 'desc' },
      select: { actorId: true, action: true, metadata: true },
    });
    expect(auditEntry).toMatchObject({ actorId, action: 'inventory.stock.received' });
    expect(JSON.stringify(auditEntry.metadata)).not.toContain(trackedImei);
  });

  it('rejects a duplicate IMEI atomically across the inventory platform', async () => {
    await expect(inventory.receiveInventory(actor, {
      sku: trackedSkuCode,
      toLocationId: sourceLocationId,
      quantity: 1,
      idempotencyKey: `inventory-db-duplicate-imei-${suffix}`,
      devices: [{ imei: trackedImei }],
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

    const trackedSku = await database.prisma.productSku.findUniqueOrThrow({ where: { code: trackedSkuCode }, select: { variantId: true } });
    const [sourceProjection, destinationProjection] = await Promise.all([
      database.prisma.branchInventory.findUnique({
        where: { branchId_variantId: { branchId: branchOneId, variantId: trackedSku.variantId } },
        select: { onHand: true, reserved: true },
      }),
      database.prisma.branchInventory.findUnique({
        where: { branchId_variantId: { branchId: branchTwoId, variantId: trackedSku.variantId } },
        select: { onHand: true, reserved: true },
      }),
    ]);
    expect(sourceProjection).toEqual({ onHand: 0, reserved: 0 });
    expect(destinationProjection).toEqual({ onHand: 1, reserved: 0 });
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

    const trackedSku = await database.prisma.productSku.findUniqueOrThrow({ where: { code: trackedSkuCode }, select: { variantId: true } });
    await expect(database.prisma.branchInventory.findUnique({
      where: { branchId_variantId: { branchId: branchTwoId, variantId: trackedSku.variantId } },
      select: { onHand: true, reserved: true },
    })).resolves.toEqual({ onHand: 1, reserved: 1 });

    await expect(inventory.releaseInventoryReservation(actor, {
      reservationId,
      idempotencyKey: `inventory-db-release-${suffix}`,
    }, audit('release'))).resolves.toMatchObject({ id: reservationId, status: 'RELEASED', idempotent: false });

    const afterRelease = await database.prisma.deviceUnit.findUniqueOrThrow({
      where: { id: deviceUnitId },
      select: { status: true, reservationId: true },
    });
    expect(afterRelease).toEqual({ status: 'AVAILABLE', reservationId: null });
    await expect(database.prisma.branchInventory.findUnique({
      where: { branchId_variantId: { branchId: branchTwoId, variantId: trackedSku.variantId } },
      select: { onHand: true, reserved: true },
    })).resolves.toEqual({ onHand: 1, reserved: 0 });
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

    const bulkSku = await database.prisma.productSku.findUniqueOrThrow({ where: { code: untrackedSkuCode }, select: { variantId: true } });
    await expect(database.prisma.branchInventory.findUnique({
      where: { branchId_variantId: { branchId: branchOneId, variantId: bulkSku.variantId } },
      select: { onHand: true, reserved: true },
    })).resolves.toEqual({ onHand: 2, reserved: 0 });

    await expect(inventory.adjustInventory(actor, {
      sku: untrackedSkuCode,
      locationId: sourceLocationId,
      quantity: 3,
      direction: 'DECREASE',
      reason: 'Intentional invariant probe',
      idempotencyKey: `inventory-db-bulk-negative-${suffix}`,
    }, audit('adjust-negative'))).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('allows a bound BRANCH_MANAGER to read and mutate only its own branch, with attributable safe audit evidence', async () => {
    const branchManager: SessionActor = {
      id: branchManagerId,
      roleCodes: ['BRANCH_MANAGER'],
      permissions: new Set(PERMISSIONS),
      branchId: branchOneId,
      isAdmin: true,
    };
    const [branches, warehouses, inventoryPage, dashboard, deviceUnits] = await Promise.all([
      inventory.listBranches(branchManager),
      inventory.listWarehouses(branchManager),
      inventory.listInventory(branchManager, { page: 1, pageSize: 100 }),
      inventory.inventoryDashboard(branchManager),
      inventory.listDeviceUnits(branchManager, { page: 1, pageSize: 100 }),
    ]);
    expect(branches.items.map((branch) => branch.id)).toEqual([branchOneId]);
    expect(warehouses.items.every((warehouse) => warehouse.branchId === branchOneId)).toBe(true);
    expect(inventoryPage.items.every((item) => item.branch.id === branchOneId)).toBe(true);
    expect(dashboard.branchCount).toBe(1);
    expect(deviceUnits.items.every((device) => device.branch?.id === branchOneId)).toBe(true);

    const bulkItem = await database.prisma.inventoryItem.findFirstOrThrow({
      where: { locationId: sourceLocationId, sku: { is: { code: untrackedSkuCode } } },
      select: { id: true },
    });
    const created = await inventory.reserveInventory(branchManager, {
      inventoryItemId: bulkItem.id,
      quantity: 1,
      idempotencyKey: `inventory-db-branch-own-reserve-${suffix}`,
    }, auditFor(branchManagerId, 'branch-own-reserve'));
    await expect(inventory.releaseInventoryReservation(branchManager, {
      reservationId: created.id,
      idempotencyKey: `inventory-db-branch-own-release-${suffix}`,
    }, auditFor(branchManagerId, 'branch-own-release'))).resolves.toMatchObject({
      id: created.id,
      status: 'RELEASED',
    });

    const auditEntry = await database.prisma.auditLog.findFirstOrThrow({
      where: { actorId: branchManagerId, action: 'inventory.reservation.released', entityId: created.id },
      select: { actorId: true, action: true, metadata: true },
    });
    expect(auditEntry).toMatchObject({ actorId: branchManagerId, action: 'inventory.reservation.released' });
    expect(JSON.stringify(auditEntry.metadata)).not.toContain(trackedImei);
  });

  it('fails closed for unbound branch managers and denies every cross-branch read or mutation path', async () => {
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

    const scopedActor: SessionActor = {
      ...actor,
      id: branchManagerId,
      roleCodes: ['BRANCH_MANAGER'],
      permissions: new Set(branchManagerPermissions),
      branchId: branchOneId,
    };
    const unboundBranchManager: SessionActor = {
      ...scopedActor,
      roleCodes: ['BRANCH_MANAGER'],
      branchId: null,
    };

    await expect(inventory.listBranches(unboundBranchManager)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(inventory.listInventory(unboundBranchManager, { page: 1, pageSize: 25 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(inventory.inventoryDashboard(unboundBranchManager)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(inventory.listWarehouses(unboundBranchManager)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(inventory.listDeviceUnits(unboundBranchManager, { page: 1, pageSize: 25 })).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(inventory.listInventory(scopedActor, { page: 1, pageSize: 25, branchId: branchTwoId })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(inventory.inventoryDashboard(scopedActor, branchTwoId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(inventory.listWarehouses(scopedActor, 1, 25, branchTwoId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(inventory.listDeviceUnits(scopedActor, { page: 1, pageSize: 25, branchId: branchTwoId })).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(inventory.receiveInventory(scopedActor, {
      sku: untrackedSkuCode,
      toLocationId: destinationLocationId,
      quantity: 1,
      idempotencyKey: `inventory-db-cross-branch-receive-${suffix}`,
    }, audit('cross-branch-receive'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(inventory.adjustInventory(scopedActor, {
      sku: untrackedSkuCode,
      locationId: destinationLocationId,
      quantity: 1,
      direction: 'INCREASE',
      reason: 'cross branch must fail',
      idempotencyKey: `inventory-db-cross-branch-adjust-${suffix}`,
    }, audit('cross-branch-adjust'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
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

    await expect(inventory.createBranch(scopedActor, {
      code: `BLOCKED-${codeSuffix}`,
      name: 'Branch creation must require global scope',
      kind: 'STORE',
      status: 'ACTIVE',
      isPickupEnabled: true,
    }, audit('cross-branch-create'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(inventory.configureSkuTracking(scopedActor, {
      sku: untrackedSkuCode,
      trackingMode: 'IMEI',
    }, audit('cross-branch-policy'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
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

    try {
      await expect(inventory.reserveInventory(actor, {
        inventoryItemId: bulkItem.id,
        quantity: 1,
        idempotencyKey: `inventory-db-disabled-reservation-${suffix}`,
      }, audit('disabled-location-reservation'))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    } finally {
      // This test intentionally proves the rejection, then restores the
      // physical fixture so later reconciliation observes no artificial
      // status-only projection drift.
      await database.prisma.inventoryLocation.update({
        where: { id: sourceLocationId },
        data: { status: 'ACTIVE' },
      });
    }
  });

  it('excludes damaged physical stock from sellable projection and public availability', async () => {
    const destinationLocation = await database.prisma.inventoryLocation.findUniqueOrThrow({
      where: { id: destinationLocationId },
      select: { warehouseId: true },
    });
    const untrackedSku = await database.prisma.productSku.findUniqueOrThrow({
      where: { code: untrackedSkuCode },
      select: { variantId: true },
    });
    const damagedLocation = await database.prisma.inventoryLocation.create({
      data: {
        warehouseId: destinationLocation.warehouseId,
        code: `DAMAGED-${codeSuffix}`,
        name: 'Damaged stock must not be sellable',
        type: 'DAMAGED',
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    const received = await inventory.receiveInventory(actor, {
      sku: untrackedSkuCode,
      toLocationId: damagedLocation.id,
      quantity: 3,
      idempotencyKey: `inventory-db-damaged-receive-${suffix}`,
    }, audit('receive-damaged'));

    await expect(inventory.reserveInventory(actor, {
      inventoryItemId: received.inventoryItem.id,
      quantity: 1,
      idempotencyKey: `inventory-db-damaged-reservation-${suffix}`,
    }, audit('reserve-damaged'))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    await expect(database.prisma.branchInventory.findUnique({
      where: { branchId_variantId: { branchId: branchTwoId, variantId: untrackedSku.variantId } },
      select: { onHand: true, reserved: true },
    })).resolves.toEqual({ onHand: 0, reserved: 0 });

    const availability = await inventory.inventoryAvailabilityBySku(untrackedSkuCode);
    expect(availability).toMatchObject({ skuCode: untrackedSkuCode, availability: 'LIMITED' });
    expect(availability.branches).toEqual(expect.arrayContaining([
      expect.objectContaining({ branchId: branchOneId, availability: 'LIMITED' }),
    ]));
    expect(availability.branches).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ branchId: branchTwoId }),
    ]));
  });

  it('synchronizes sellable projection through non-sellable transfers and operational status changes', async () => {
    const destinationLocation = await database.prisma.inventoryLocation.findUniqueOrThrow({
      where: { id: destinationLocationId },
      select: { warehouseId: true },
    });
    const damagedLocation = await database.prisma.inventoryLocation.findUniqueOrThrow({
      where: { warehouseId_code: {
        warehouseId: destinationLocation.warehouseId,
        code: `DAMAGED-${codeSuffix}`,
      } },
      select: { id: true },
    });
    const bulkVariant = await database.prisma.productSku.findUniqueOrThrow({
      where: { code: untrackedSkuCode },
      select: { variantId: true },
    });

    await inventory.transferInventory(actor, {
      sku: untrackedSkuCode,
      fromLocationId: sourceLocationId,
      toLocationId: damagedLocation.id,
      quantity: 1,
      idempotencyKey: `inventory-db-storage-to-damaged-${suffix}`,
    }, audit('transfer-to-damaged'));

    const [sourceAfterTransfer, destinationAfterTransfer] = await Promise.all([
      database.prisma.branchInventory.findUnique({
        where: { branchId_variantId: { branchId: branchOneId, variantId: bulkVariant.variantId } },
        select: { onHand: true, reserved: true },
      }),
      database.prisma.branchInventory.findUnique({
        where: { branchId_variantId: { branchId: branchTwoId, variantId: bulkVariant.variantId } },
        select: { onHand: true, reserved: true },
      }),
    ]);
    expect(sourceAfterTransfer).toEqual({ onHand: 1, reserved: 0 });
    expect(destinationAfterTransfer).toEqual({ onHand: 0, reserved: 0 });

    await inventory.updateWarehouse(actor, sourceWarehouseId, { status: 'DISABLED' }, audit('disable-warehouse'));
    await expect(database.prisma.branchInventory.findUnique({
      where: { branchId_variantId: { branchId: branchOneId, variantId: bulkVariant.variantId } },
      select: { onHand: true, reserved: true },
    })).resolves.toEqual({ onHand: 0, reserved: 0 });

    await inventory.updateWarehouse(actor, sourceWarehouseId, { status: 'ACTIVE' }, audit('enable-warehouse'));
    await inventory.updateBranch(actor, branchOneId, { status: 'DISABLED' }, audit('disable-branch'));
    await expect(database.prisma.branchInventory.findUnique({
      where: { branchId_variantId: { branchId: branchOneId, variantId: bulkVariant.variantId } },
      select: { onHand: true, reserved: true },
    })).resolves.toEqual({ onHand: 0, reserved: 0 });

    await inventory.updateBranch(actor, branchOneId, { status: 'ACTIVE' }, audit('enable-branch'));
    await expect(database.prisma.branchInventory.findUnique({
      where: { branchId_variantId: { branchId: branchOneId, variantId: bulkVariant.variantId } },
      select: { onHand: true, reserved: true },
    })).resolves.toEqual({ onHand: 1, reserved: 0 });
  });
});
