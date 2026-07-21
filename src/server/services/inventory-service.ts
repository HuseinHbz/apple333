import { Prisma } from '@prisma/client';

import type {
  BranchInventoryAvailabilityDto,
  InventoryAvailability,
  InventoryAvailabilityDto,
  InventoryBranchDto,
  InventoryDashboardDto,
  InventoryDeviceUnitDto,
  InventoryItemDto,
  InventoryLocationDto,
  InventoryMovementDto,
  InventoryWarehouseDto,
} from '@/modules/inventory/types';
import { toInventoryAvailability } from '@/modules/inventory/availability';
import type {
  AdjustInventoryInput,
  CreateBranchInput,
  CreateInventoryReservationInput,
  CreateWarehouseInput,
  InventoryDeviceListQuery,
  InventoryPageQuery,
  ReceiveInventoryInput,
  TransferInventoryInput,
  UpdateBranchInput,
  UpdateWarehouseInput,
} from '@/modules/inventory/validators';
import { auditInput } from '@/server/admin/audit';
import type { AdminAuditContext, Page } from '@/server/admin/types';
import { toPage } from '@/server/admin/pagination';
import { prisma } from '@/server/db/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/server/errors/app-error';
import { auditLogRepository } from '@/server/repositories/audit-log-repository';
import {
  inventoryRepository,
  type BranchRecord,
  type DeviceUnitRecord,
  type InventoryItemRecord,
  type InventoryLocationRecord,
  type StockMovementRecord,
  type WarehouseRecord,
} from '@/server/repositories/inventory-repository';
import { requireBranchAccess, type SessionActor } from '@/server/security/permissions';

type Transaction = Prisma.TransactionClient;

function toIso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

export function inventoryAvailability(availableQuantity: number): InventoryAvailability {
  return toInventoryAvailability(availableQuantity);
}

function mapLocation(record: InventoryLocationRecord): InventoryLocationDto {
  return {
    id: record.id,
    warehouseId: record.warehouseId,
    code: record.code,
    name: record.name,
    type: record.type,
    status: record.status,
  };
}

function mapBranch(record: BranchRecord): InventoryBranchDto {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    kind: record.kind,
    status: record.status,
    city: record.city,
    address: record.address,
    phone: record.phone,
    isPickupEnabled: record.isPickupEnabled,
    warehouseCount: record._count.warehouses,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapWarehouse(record: WarehouseRecord): InventoryWarehouseDto {
  return {
    id: record.id,
    branchId: record.branchId,
    branch: record.branch,
    code: record.code,
    name: record.name,
    status: record.status,
    locations: record.locations.map(mapLocation),
    locationCount: record._count.locations,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapInventoryItem(record: InventoryItemRecord): InventoryItemDto {
  const warehouse = record.location.warehouse;
  return {
    id: record.id,
    sku: {
      id: record.sku.id,
      code: record.sku.code,
      barcode: record.sku.barcode,
      variantId: record.sku.variantId,
      productName: record.sku.variant.product.name,
      variantTitle: record.sku.variant.title,
      categoryId: record.sku.variant.product.categoryId,
    },
    branch: warehouse.branch,
    warehouse: { id: warehouse.id, code: warehouse.code, name: warehouse.name, status: warehouse.status },
    location: mapLocation(record.location),
    quantity: record.quantity,
    reservedQuantity: record.reservedQuantity,
    availableQuantity: record.availableQuantity,
    availability: inventoryAvailability(record.availableQuantity),
    trackingMode: record.sku.inventoryPolicy?.trackingMode ?? 'NONE',
    version: record.version,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapMovement(record: StockMovementRecord): InventoryMovementDto {
  return {
    id: record.id,
    skuId: record.skuId,
    skuCode: record.sku.code,
    type: record.type,
    adjustmentDirection: record.adjustmentDirection,
    quantity: record.quantity,
    fromLocationId: record.fromLocationId,
    toLocationId: record.toLocationId,
    reference: record.reference,
    createdAt: record.createdAt.toISOString(),
  };
}

function maskIdentifier(value: string | null): string | null {
  if (!value) return null;
  const suffix = value.slice(-4);
  return `${'•'.repeat(Math.max(0, value.length - suffix.length))}${suffix}`;
}

function mapDeviceUnit(record: DeviceUnitRecord): InventoryDeviceUnitDto {
  return {
    id: record.id,
    skuCode: record.sku.code,
    skuId: record.skuId,
    inventoryItemId: record.inventoryItemId,
    branch: record.inventoryItem?.location.warehouse.branch ?? null,
    imeiMasked: maskIdentifier(record.imei),
    serialNumberMasked: maskIdentifier(record.serialNumber),
    status: record.status,
    warrantyExpiresAt: toIso(record.warrantyExpiresAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function scopedBranchId(actor: SessionActor, candidate: string | undefined): string | undefined {
  if (!actor.branchId) return candidate;
  if (candidate !== undefined && candidate !== actor.branchId) {
    requireBranchAccess(actor, candidate);
  }
  return actor.branchId;
}

function assertLocationActive(location: InventoryLocationRecord & {
  warehouse: { id: string; branchId: string; status: string; branch: { id: string; status: string } };
}): void {
  if (location.status !== 'ACTIVE' || location.warehouse.status !== 'ACTIVE' || location.warehouse.branch.status !== 'ACTIVE') {
    throw new ValidationError({ locationId: 'Inventory changes require an active branch, warehouse, and location.' });
  }
}

function assertSkuOperational(sku: { status: string; deletedAt: Date | null }): void {
  if (sku.status !== 'ACTIVE' || sku.deletedAt) {
    throw new ValidationError({ sku: 'Only active catalog SKUs can receive inventory changes.' });
  }
}

function identifierAuditSummary(input: ReceiveInventoryInput): Readonly<{
  trackedDeviceCount: number;
  imeiCount: number;
  serialNumberCount: number;
}> {
  return {
    trackedDeviceCount: input.devices?.length ?? 0,
    imeiCount: input.devices?.filter((device) => device.imei !== undefined).length ?? 0,
    serialNumberCount: input.devices?.filter((device) => device.serialNumber !== undefined).length ?? 0,
  };
}

function assertTrackingPolicy(
  mode: 'NONE' | 'SERIAL' | 'IMEI' | 'SERIAL_AND_IMEI',
  input: ReceiveInventoryInput,
): void {
  const devices = input.devices ?? [];
  if (mode === 'NONE') {
    if (devices.length > 0) {
      throw new ValidationError({ devices: 'This SKU is not configured for serial or IMEI tracking.' });
    }
    return;
  }
  if (devices.length !== input.quantity) {
    throw new ValidationError({ devices: 'Every received unit requires its configured tracking identifier.' });
  }
  const missing = devices.some((device) =>
    (mode === 'IMEI' && !device.imei)
    || (mode === 'SERIAL' && !device.serialNumber)
    || (mode === 'SERIAL_AND_IMEI' && (!device.imei || !device.serialNumber)),
  );
  if (missing) {
    throw new ValidationError({ devices: `Tracking mode ${mode} requires all required identifiers.` });
  }
  const imeis = devices.flatMap((device) => device.imei === undefined ? [] : [device.imei]);
  const serialNumbers = devices.flatMap((device) => device.serialNumber === undefined ? [] : [device.serialNumber]);
  if (new Set(imeis).size !== imeis.length || new Set(serialNumbers).size !== serialNumbers.length) {
    throw new ValidationError({ devices: 'A received batch cannot contain a duplicate IMEI or serial number.' });
  }
}

function assertTrackedDeviceSelection(
  mode: 'NONE' | 'SERIAL' | 'IMEI' | 'SERIAL_AND_IMEI',
  deviceUnitIds: readonly string[] | undefined,
  quantity: number,
  field: 'deviceUnitIds',
): void {
  if (mode === 'NONE') {
    if (deviceUnitIds && deviceUnitIds.length > 0) {
      throw new ValidationError({ [field]: 'This SKU is not configured for device-level tracking.' });
    }
    return;
  }
  if (!deviceUnitIds || deviceUnitIds.length !== quantity) {
    throw new ValidationError({ [field]: 'Every tracked unit must be selected for this operation.' });
  }
}

function assertAdjustmentAllowedForTracking(mode: 'NONE' | 'SERIAL' | 'IMEI' | 'SERIAL_AND_IMEI'): void {
  if (mode !== 'NONE') {
    throw new ValidationError({
      sku: 'Tracked devices cannot use generic adjustments. Receive, transfer, reserve, or a future inspected-device workflow must select device units explicitly.',
    });
  }
}

async function runSerializable<T>(callback: (transaction: Transaction) => Promise<T>): Promise<T> {
  return prisma.$transaction(callback, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function runInventoryTransaction<T>(callback: (transaction: Transaction) => Promise<T>): Promise<T> {
  try {
    return await runSerializable(callback);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
      throw new ConflictError();
    }
    throw error;
  }
}

async function resolveLocation(id: string, actor: SessionActor, transaction: Transaction) {
  const location = await inventoryRepository.findLocationById(id, transaction);
  if (!location) throw new NotFoundError();
  requireBranchAccess(actor, location.warehouse.branchId);
  assertLocationActive(location);
  return location;
}

/**
 * Idempotent replays must be authorized against the persisted resource too.
 * We intentionally do not require the location to remain active here: an
 * already-completed operation must still be safely replayable after a branch
 * or warehouse is disabled, but never by an actor outside that branch.
 */
async function requireReplayLocationAccess(
  locationId: string,
  actor: SessionActor,
  transaction: Transaction,
): Promise<void> {
  const location = await inventoryRepository.findLocationById(locationId, transaction);
  if (!location) throw new ConflictError();
  requireBranchAccess(actor, location.warehouse.branchId);
}

function assertReservableInventoryItem(item: InventoryItemRecord): void {
  const { location } = item;
  if (
    location.status !== 'ACTIVE'
    || location.warehouse.status !== 'ACTIVE'
    || location.warehouse.branch.status !== 'ACTIVE'
  ) {
    throw new ValidationError({
      inventoryItemId: 'Inventory reservations require an active branch, warehouse, and location.',
    });
  }
}

async function resolveSku(code: string, transaction: Transaction) {
  const sku = await inventoryRepository.findSkuByCode(code, transaction);
  if (!sku) throw new NotFoundError();
  assertSkuOperational(sku);
  return sku;
}

type BalanceChange = Readonly<{ quantityDelta: number; reservedDelta: number }>;

async function changeBalance(
  input: Readonly<{ locationId: string; warehouseId: string; skuId: string; change: BalanceChange }>,
  transaction: Transaction,
): Promise<Readonly<{ before: InventoryItemRecord | null; after: InventoryItemRecord }>> {
  const before = await inventoryRepository.findInventoryItemByLocationSku(input.locationId, input.skuId, transaction);
  if (!before) {
    if (input.change.quantityDelta < 0 || input.change.reservedDelta !== 0) {
      throw new ConflictError();
    }
    const after = await inventoryRepository.createInventoryItem({
      warehouseId: input.warehouseId,
      locationId: input.locationId,
      skuId: input.skuId,
      quantity: input.change.quantityDelta,
      reservedQuantity: 0,
      availableQuantity: input.change.quantityDelta,
    }, transaction);
    return { before: null, after };
  }

  const nextQuantity = before.quantity + input.change.quantityDelta;
  const nextReserved = before.reservedQuantity + input.change.reservedDelta;
  const nextAvailable = nextQuantity - nextReserved;
  if (nextQuantity < 0 || nextReserved < 0 || nextReserved > nextQuantity || nextAvailable < 0) {
    throw new ConflictError();
  }
  const result = await inventoryRepository.updateInventoryItemWithVersion(before.id, before.version, {
    quantity: nextQuantity,
    reservedQuantity: nextReserved,
    availableQuantity: nextAvailable,
    version: { increment: 1 },
  }, transaction);
  if (result.count !== 1) throw new ConflictError();
  const after = await inventoryRepository.findInventoryItemById(before.id, transaction);
  if (!after) throw new NotFoundError();
  return { before, after };
}

function balanceAuditState(record: InventoryItemRecord | null) {
  if (!record) return null;
  return {
    inventoryItemId: record.id,
    quantity: record.quantity,
    reservedQuantity: record.reservedQuantity,
    availableQuantity: record.availableQuantity,
    version: record.version,
  };
}

async function applyProjectionDeltas(
  sku: Readonly<{ variantId: string }>,
  deltas: readonly Readonly<{ branchId: string; onHandDelta?: number; reservedDelta?: number }>[],
  transaction: Transaction,
): Promise<void> {
  const merged = new Map<string, { onHandDelta: number; reservedDelta: number }>();
  for (const delta of deltas) {
    const current = merged.get(delta.branchId) ?? { onHandDelta: 0, reservedDelta: 0 };
    current.onHandDelta += delta.onHandDelta ?? 0;
    current.reservedDelta += delta.reservedDelta ?? 0;
    merged.set(delta.branchId, current);
  }
  for (const [branchId, delta] of merged) {
    await inventoryRepository.updateLegacyBranchProjection({ branchId, variantId: sku.variantId, ...delta }, transaction);
  }
}

export async function listInventory(
  actor: SessionActor,
  query: InventoryPageQuery,
): Promise<Page<InventoryItemDto>> {
  const result = await inventoryRepository.findInventoryPage({ ...query, branchId: scopedBranchId(actor, query.branchId) });
  return toPage(result.items.map(mapInventoryItem), query, result.total);
}

export async function getInventoryBySku(
  actor: SessionActor,
  sku: string,
): Promise<Page<InventoryItemDto>> {
  return listInventory(actor, { page: 1, pageSize: 100, sku, branchId: scopedBranchId(actor, undefined) });
}

export async function inventoryDashboard(actor: SessionActor, branchId?: string): Promise<InventoryDashboardDto> {
  const result = await inventoryRepository.dashboard(scopedBranchId(actor, branchId));
  return {
    totalQuantity: result.balances._sum.quantity ?? 0,
    availableQuantity: result.balances._sum.availableQuantity ?? 0,
    reservedQuantity: result.balances._sum.reservedQuantity ?? 0,
    damagedQuantity: result.damaged._sum.quantity ?? 0,
    skuCount: result.skuCount,
    branchCount: result.branchCount,
  };
}

export async function listBranches(actor: SessionActor, page = 1, pageSize = 100): Promise<Page<InventoryBranchDto>> {
  const result = await inventoryRepository.findBranchPage({ page, pageSize, ...(actor.branchId ? { branchId: actor.branchId } : {}) });
  return toPage(result.items.map(mapBranch), { page, pageSize }, result.total);
}

export async function createBranch(input: CreateBranchInput, context: AdminAuditContext): Promise<InventoryBranchDto> {
  const record = await runInventoryTransaction(async (transaction) => {
    const branch = await inventoryRepository.createBranch(input, transaction);
    await auditLogRepository.create(auditInput(context, {
      action: 'inventory.branch.created',
      entityType: 'Branch',
      entityId: branch.id,
      metadata: { code: branch.code, kind: branch.kind, status: branch.status },
    }), transaction);
    return branch;
  });
  return mapBranch(record);
}

export async function updateBranch(
  actor: SessionActor,
  id: string,
  input: UpdateBranchInput,
  context: AdminAuditContext,
): Promise<InventoryBranchDto> {
  const record = await runInventoryTransaction(async (transaction) => {
    const existing = await inventoryRepository.findBranchById(id, transaction);
    if (!existing) throw new NotFoundError();
    requireBranchAccess(actor, id);
    const status = input.status;
    const branch = await inventoryRepository.updateBranch(id, {
      ...(input.code === undefined ? {} : { code: input.code }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.kind === undefined ? {} : { kind: input.kind }),
      ...(status === undefined ? {} : { status, isActive: status === 'ACTIVE' }),
      ...(input.city === undefined ? {} : { city: input.city }),
      ...(input.address === undefined ? {} : { address: input.address }),
      ...(input.phone === undefined ? {} : { phone: input.phone }),
      ...(input.isPickupEnabled === undefined ? {} : { isPickupEnabled: input.isPickupEnabled }),
    }, transaction);
    await auditLogRepository.create(auditInput(context, {
      action: 'inventory.branch.updated',
      entityType: 'Branch',
      entityId: id,
      metadata: { before: { code: existing.code, status: existing.status }, after: { code: branch.code, status: branch.status } },
    }), transaction);
    return branch;
  });
  return mapBranch(record);
}

export async function listWarehouses(actor: SessionActor, page = 1, pageSize = 100, branchId?: string): Promise<Page<InventoryWarehouseDto>> {
  const scoped = scopedBranchId(actor, branchId);
  const result = await inventoryRepository.findWarehousePage({ page, pageSize, ...(scoped ? { branchId: scoped } : {}) });
  return toPage(result.items.map(mapWarehouse), { page, pageSize }, result.total);
}

export async function createWarehouse(
  actor: SessionActor,
  input: CreateWarehouseInput,
  context: AdminAuditContext,
): Promise<InventoryWarehouseDto> {
  const record = await runInventoryTransaction(async (transaction) => {
    const branch = await inventoryRepository.findBranchById(input.branchId, transaction);
    if (!branch) throw new NotFoundError();
    requireBranchAccess(actor, branch.id);
    if (branch.status !== 'ACTIVE') throw new ValidationError({ branchId: 'Warehouses can only be assigned to active branches.' });
    const warehouse = await inventoryRepository.createWarehouse(input, transaction);
    await auditLogRepository.create(auditInput(context, {
      action: 'inventory.warehouse.created',
      entityType: 'Warehouse',
      entityId: warehouse.id,
      metadata: { branchId: warehouse.branchId, code: warehouse.code, status: warehouse.status, locationCount: warehouse._count.locations },
    }), transaction);
    return warehouse;
  });
  return mapWarehouse(record);
}

export async function updateWarehouse(
  actor: SessionActor,
  id: string,
  input: UpdateWarehouseInput,
  context: AdminAuditContext,
): Promise<InventoryWarehouseDto> {
  const record = await runInventoryTransaction(async (transaction) => {
    const existing = await inventoryRepository.findWarehouseById(id, transaction);
    if (!existing) throw new NotFoundError();
    requireBranchAccess(actor, existing.branchId);
    const warehouse = await inventoryRepository.updateWarehouse(id, {
      ...(input.code === undefined ? {} : { code: input.code }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.status === undefined ? {} : { status: input.status }),
    }, transaction);
    await auditLogRepository.create(auditInput(context, {
      action: 'inventory.warehouse.updated',
      entityType: 'Warehouse',
      entityId: id,
      metadata: { before: { code: existing.code, status: existing.status }, after: { code: warehouse.code, status: warehouse.status } },
    }), transaction);
    return warehouse;
  });
  return mapWarehouse(record);
}

export async function receiveInventory(
  actor: SessionActor,
  input: ReceiveInventoryInput,
  context: AdminAuditContext,
): Promise<Readonly<{ movement: InventoryMovementDto; inventoryItem: InventoryItemDto; idempotent: boolean }>> {
  return runInventoryTransaction(async (transaction) => {
    const existing = await inventoryRepository.findMovementByIdempotencyKey(input.idempotencyKey, transaction);
    if (existing) {
      if (existing.type !== 'PURCHASE') throw new ConflictError();
      if (!existing.toLocationId) throw new ConflictError();
      await requireReplayLocationAccess(existing.toLocationId, actor, transaction);
      const item = existing.toLocationId
        ? await inventoryRepository.findInventoryItemByLocationSku(existing.toLocationId, existing.skuId, transaction)
        : null;
      if (!item) throw new ConflictError();
      return { movement: mapMovement(existing), inventoryItem: mapInventoryItem(item), idempotent: true };
    }
    const [location, sku] = await Promise.all([
      resolveLocation(input.toLocationId, actor, transaction),
      resolveSku(input.sku, transaction),
    ]);
    const mode = sku.inventoryPolicy?.trackingMode ?? 'NONE';
    assertTrackingPolicy(mode, input);
    const balance = await changeBalance({
      locationId: location.id,
      warehouseId: location.warehouseId,
      skuId: sku.id,
      change: { quantityDelta: input.quantity, reservedDelta: 0 },
    }, transaction);
    const movement = await inventoryRepository.createMovement({
      skuId: sku.id,
      toLocationId: location.id,
      quantity: input.quantity,
      type: 'PURCHASE',
      reference: input.reference ?? null,
      idempotencyKey: input.idempotencyKey,
      performedById: actor.id,
      metadata: { operation: 'receive' },
    }, transaction);
    if (input.devices && input.devices.length > 0) {
      await inventoryRepository.createDeviceUnits(input.devices.map((device) => ({
        skuId: sku.id,
        inventoryItemId: balance.after.id,
        ...(device.imei === undefined ? {} : { imei: device.imei }),
        ...(device.serialNumber === undefined ? {} : { serialNumber: device.serialNumber }),
        ...(device.warrantyExpiresAt === undefined ? {} : { warrantyExpiresAt: device.warrantyExpiresAt }),
        status: 'AVAILABLE',
      })), transaction);
    }
    await applyProjectionDeltas(sku, [{ branchId: location.warehouse.branchId, onHandDelta: input.quantity }], transaction);
    await auditLogRepository.create(auditInput(context, {
      action: 'inventory.stock.received',
      entityType: 'InventoryItem',
      entityId: balance.after.id,
      metadata: {
        movementId: movement.id,
        skuCode: sku.code,
        locationId: location.id,
        before: balanceAuditState(balance.before),
        after: balanceAuditState(balance.after),
        ...identifierAuditSummary(input),
      },
    }), transaction);
    return { movement: mapMovement(movement), inventoryItem: mapInventoryItem(balance.after), idempotent: false };
  });
}

export async function adjustInventory(
  actor: SessionActor,
  input: AdjustInventoryInput,
  context: AdminAuditContext,
): Promise<Readonly<{ movement: InventoryMovementDto; inventoryItem: InventoryItemDto; idempotent: boolean }>> {
  return runInventoryTransaction(async (transaction) => {
    const existing = await inventoryRepository.findMovementByIdempotencyKey(input.idempotencyKey, transaction);
    if (existing) {
      if (existing.type !== 'ADJUSTMENT') throw new ConflictError();
      const locationId = existing.toLocationId ?? existing.fromLocationId;
      if (!locationId) throw new ConflictError();
      await requireReplayLocationAccess(locationId, actor, transaction);
      const item = locationId ? await inventoryRepository.findInventoryItemByLocationSku(locationId, existing.skuId, transaction) : null;
      if (!item) throw new ConflictError();
      return { movement: mapMovement(existing), inventoryItem: mapInventoryItem(item), idempotent: true };
    }
    const [location, sku] = await Promise.all([
      resolveLocation(input.locationId, actor, transaction),
      resolveSku(input.sku, transaction),
    ]);
    assertAdjustmentAllowedForTracking(sku.inventoryPolicy?.trackingMode ?? 'NONE');
    const increase = input.direction === 'INCREASE';
    const balance = await changeBalance({
      locationId: location.id,
      warehouseId: location.warehouseId,
      skuId: sku.id,
      change: { quantityDelta: increase ? input.quantity : -input.quantity, reservedDelta: 0 },
    }, transaction);
    const movement = await inventoryRepository.createMovement({
      skuId: sku.id,
      ...(increase ? { toLocationId: location.id } : { fromLocationId: location.id }),
      quantity: input.quantity,
      type: 'ADJUSTMENT',
      adjustmentDirection: input.direction,
      reference: input.reference ?? null,
      idempotencyKey: input.idempotencyKey,
      performedById: actor.id,
      metadata: { reason: input.reason },
    }, transaction);
    await applyProjectionDeltas(sku, [{ branchId: location.warehouse.branchId, onHandDelta: increase ? input.quantity : -input.quantity }], transaction);
    await auditLogRepository.create(auditInput(context, {
      action: 'inventory.stock.adjusted',
      entityType: 'InventoryItem',
      entityId: balance.after.id,
      metadata: {
        movementId: movement.id,
        skuCode: sku.code,
        locationId: location.id,
        direction: input.direction,
        reason: input.reason,
        before: balanceAuditState(balance.before),
        after: balanceAuditState(balance.after),
      },
    }), transaction);
    return { movement: mapMovement(movement), inventoryItem: mapInventoryItem(balance.after), idempotent: false };
  });
}

export async function transferInventory(
  actor: SessionActor,
  input: TransferInventoryInput,
  context: AdminAuditContext,
): Promise<Readonly<{ movement: InventoryMovementDto; source: InventoryItemDto; destination: InventoryItemDto; idempotent: boolean }>> {
  return runInventoryTransaction(async (transaction) => {
    const existing = await inventoryRepository.findMovementByIdempotencyKey(input.idempotencyKey, transaction);
    if (existing) {
      if (existing.type !== 'TRANSFER' || !existing.fromLocationId || !existing.toLocationId) throw new ConflictError();
      await Promise.all([
        requireReplayLocationAccess(existing.fromLocationId, actor, transaction),
        requireReplayLocationAccess(existing.toLocationId, actor, transaction),
      ]);
      const [source, destination] = await Promise.all([
        inventoryRepository.findInventoryItemByLocationSku(existing.fromLocationId, existing.skuId, transaction),
        inventoryRepository.findInventoryItemByLocationSku(existing.toLocationId, existing.skuId, transaction),
      ]);
      if (!source || !destination) throw new ConflictError();
      return { movement: mapMovement(existing), source: mapInventoryItem(source), destination: mapInventoryItem(destination), idempotent: true };
    }
    const [sourceLocation, destinationLocation, sku] = await Promise.all([
      resolveLocation(input.fromLocationId, actor, transaction),
      resolveLocation(input.toLocationId, actor, transaction),
      resolveSku(input.sku, transaction),
    ]);
    const sourceBalance = await changeBalance({
      locationId: sourceLocation.id,
      warehouseId: sourceLocation.warehouseId,
      skuId: sku.id,
      change: { quantityDelta: -input.quantity, reservedDelta: 0 },
    }, transaction);
    const destinationBalance = await changeBalance({
      locationId: destinationLocation.id,
      warehouseId: destinationLocation.warehouseId,
      skuId: sku.id,
      change: { quantityDelta: input.quantity, reservedDelta: 0 },
    }, transaction);
    const trackingMode = sku.inventoryPolicy?.trackingMode ?? 'NONE';
    assertTrackedDeviceSelection(trackingMode, input.deviceUnitIds, input.quantity, 'deviceUnitIds');
    if (trackingMode !== 'NONE') {
      const sourceInventoryItemId = sourceBalance.before?.id;
      if (!sourceInventoryItemId) throw new ConflictError();
      await inventoryRepository.transferAvailableDeviceUnits({
        deviceUnitIds: input.deviceUnitIds ?? [],
        skuId: sku.id,
        fromInventoryItemId: sourceInventoryItemId,
        toInventoryItemId: destinationBalance.after.id,
      }, transaction);
    }
    const movement = await inventoryRepository.createMovement({
      skuId: sku.id,
      fromLocationId: sourceLocation.id,
      toLocationId: destinationLocation.id,
      quantity: input.quantity,
      type: 'TRANSFER',
      reference: input.reference ?? null,
      idempotencyKey: input.idempotencyKey,
      performedById: actor.id,
    }, transaction);
    await applyProjectionDeltas(sku, [
      { branchId: sourceLocation.warehouse.branchId, onHandDelta: -input.quantity },
      { branchId: destinationLocation.warehouse.branchId, onHandDelta: input.quantity },
    ], transaction);
    await auditLogRepository.create(auditInput(context, {
      action: 'inventory.stock.transferred',
      entityType: 'StockMovement',
      entityId: movement.id,
      metadata: {
        skuCode: sku.code,
        quantity: input.quantity,
        source: { locationId: sourceLocation.id, before: balanceAuditState(sourceBalance.before), after: balanceAuditState(sourceBalance.after) },
        destination: { locationId: destinationLocation.id, before: balanceAuditState(destinationBalance.before), after: balanceAuditState(destinationBalance.after) },
      },
    }), transaction);
    return {
      movement: mapMovement(movement),
      source: mapInventoryItem(sourceBalance.after),
      destination: mapInventoryItem(destinationBalance.after),
      idempotent: false,
    };
  });
}

export async function configureSkuTracking(
  actor: SessionActor,
  input: Readonly<{ sku: string; trackingMode: 'NONE' | 'SERIAL' | 'IMEI' | 'SERIAL_AND_IMEI' }>,
  context: AdminAuditContext,
): Promise<Readonly<{ sku: string; trackingMode: 'NONE' | 'SERIAL' | 'IMEI' | 'SERIAL_AND_IMEI' }>> {
  return runInventoryTransaction(async (transaction) => {
    const sku = await resolveSku(input.sku, transaction);
    const deviceCount = await inventoryRepository.countDeviceUnitsBySku(sku.id, transaction);
    if (deviceCount > 0 && input.trackingMode === 'NONE') {
      throw new ValidationError({ trackingMode: 'A SKU with tracked device history cannot be changed to NONE.' });
    }
    const policy = await inventoryRepository.upsertSkuPolicy(sku.id, input.trackingMode, transaction);
    await auditLogRepository.create(auditInput(context, {
      action: 'inventory.sku-policy.updated',
      entityType: 'InventorySkuPolicy',
      entityId: sku.id,
      metadata: { skuCode: sku.code, trackingMode: policy.trackingMode, deviceCount },
    }), transaction);
    return { sku: sku.code, trackingMode: policy.trackingMode };
  });
}

export async function reserveInventory(
  actor: SessionActor,
  input: CreateInventoryReservationInput,
  context: AdminAuditContext,
): Promise<Readonly<{ id: string; status: string; idempotent: boolean }>> {
  return runInventoryTransaction(async (transaction) => {
    const existing = await inventoryRepository.findReservationByIdempotencyKey(input.idempotencyKey, transaction);
    if (existing) {
      const existingItem = await inventoryRepository.findInventoryItemById(existing.inventoryItemId, transaction);
      if (!existingItem) throw new ConflictError();
      requireBranchAccess(actor, existingItem.location.warehouse.branch.id);
      return { id: existing.id, status: existing.status, idempotent: true };
    }
    const item = await inventoryRepository.findInventoryItemById(input.inventoryItemId, transaction);
    if (!item) throw new NotFoundError();
    requireBranchAccess(actor, item.location.warehouse.branch.id);
    assertReservableInventoryItem(item);
    const trackingMode = item.sku.inventoryPolicy?.trackingMode ?? 'NONE';
    assertTrackedDeviceSelection(trackingMode, input.deviceUnitIds, input.quantity, 'deviceUnitIds');
    const balance = await changeBalance({
      locationId: item.locationId,
      warehouseId: item.warehouseId,
      skuId: item.skuId,
      change: { quantityDelta: 0, reservedDelta: input.quantity },
    }, transaction);
    const reservation = await inventoryRepository.createReservation({
      inventoryItemId: item.id,
      quantity: input.quantity,
      reference: input.reference ?? null,
      ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
      idempotencyKey: input.idempotencyKey,
      createdById: actor.id,
    }, transaction);
    if (trackingMode !== 'NONE') {
      await inventoryRepository.reserveAvailableDeviceUnits({
        deviceUnitIds: input.deviceUnitIds ?? [],
        skuId: item.skuId,
        inventoryItemId: item.id,
        reservationId: reservation.id,
      }, transaction);
    }
    const movement = await inventoryRepository.createMovement({
      skuId: item.skuId,
      fromLocationId: item.locationId,
      quantity: input.quantity,
      type: 'SALE_RESERVED',
      adjustmentDirection: 'DECREASE',
      reference: input.reference ?? null,
      idempotencyKey: `reservation:${input.idempotencyKey}`,
      performedById: actor.id,
      metadata: { reservationId: reservation.id },
    }, transaction);
    await applyProjectionDeltas(item.sku, [{ branchId: item.location.warehouse.branch.id, reservedDelta: input.quantity }], transaction);
    await auditLogRepository.create(auditInput(context, {
      action: 'inventory.reservation.created',
      entityType: 'InventoryReservation',
      entityId: reservation.id,
      metadata: { movementId: movement.id, inventoryItemId: item.id, quantity: input.quantity, before: balanceAuditState(balance.before), after: balanceAuditState(balance.after) },
    }), transaction);
    return { id: reservation.id, status: reservation.status, idempotent: false };
  });
}

export async function releaseInventoryReservation(
  actor: SessionActor,
  input: Readonly<{ reservationId: string; idempotencyKey: string }>,
  context: AdminAuditContext,
): Promise<Readonly<{ id: string; status: string; idempotent: boolean }>> {
  return runInventoryTransaction(async (transaction) => {
    const releaseIdempotencyKey = `reservation-release:${input.reservationId}:${input.idempotencyKey}`;
    const replay = await inventoryRepository.findMovementByIdempotencyKey(releaseIdempotencyKey, transaction);
    if (replay) {
      const reservation = await inventoryRepository.findReservationById(input.reservationId, transaction);
      if (!reservation) throw new ConflictError();
      const item = await inventoryRepository.findInventoryItemById(reservation.inventoryItemId, transaction);
      if (!item) throw new ConflictError();
      requireBranchAccess(actor, item.location.warehouse.branch.id);
      return { id: reservation.id, status: reservation.status, idempotent: true };
    }
    const reservation = await inventoryRepository.findReservationById(input.reservationId, transaction);
    if (!reservation) throw new NotFoundError();
    if (reservation.status !== 'ACTIVE') throw new ConflictError();
    const item = await inventoryRepository.findInventoryItemById(reservation.inventoryItemId, transaction);
    if (!item) throw new NotFoundError();
    requireBranchAccess(actor, item.location.warehouse.branch.id);
    const balance = await changeBalance({
      locationId: item.locationId,
      warehouseId: item.warehouseId,
      skuId: item.skuId,
      change: { quantityDelta: 0, reservedDelta: -reservation.quantity },
    }, transaction);
    const released = await inventoryRepository.releaseReservationIfActive(reservation.id, transaction);
    if (released.count !== 1) throw new ConflictError();
    if ((item.sku.inventoryPolicy?.trackingMode ?? 'NONE') !== 'NONE') {
      await inventoryRepository.releaseReservedDeviceUnits(reservation.id, reservation.quantity, transaction);
    }
    const movement = await inventoryRepository.createMovement({
      skuId: item.skuId,
      toLocationId: item.locationId,
      quantity: reservation.quantity,
      type: 'SALE_RESERVED',
      adjustmentDirection: 'INCREASE',
      reference: reservation.reference,
      idempotencyKey: releaseIdempotencyKey,
      performedById: actor.id,
      metadata: { reservationId: reservation.id },
    }, transaction);
    await applyProjectionDeltas(item.sku, [{ branchId: item.location.warehouse.branch.id, reservedDelta: -reservation.quantity }], transaction);
    await auditLogRepository.create(auditInput(context, {
      action: 'inventory.reservation.released',
      entityType: 'InventoryReservation',
      entityId: reservation.id,
      metadata: { movementId: movement.id, inventoryItemId: item.id, quantity: reservation.quantity, before: balanceAuditState(balance.before), after: balanceAuditState(balance.after) },
    }), transaction);
    return { id: reservation.id, status: 'RELEASED', idempotent: false };
  });
}

export async function listDeviceUnits(
  actor: SessionActor,
  query: InventoryDeviceListQuery,
): Promise<Page<InventoryDeviceUnitDto>> {
  const branchId = scopedBranchId(actor, query.branchId);
  const result = await inventoryRepository.findDeviceUnitPage({ ...query, ...(branchId === undefined ? {} : { branchId }) });
  return toPage(result.items.map(mapDeviceUnit), query, result.total);
}

export async function inventoryAvailabilityBySku(skuCode: string): Promise<InventoryAvailabilityDto> {
  const records = await inventoryRepository.listAvailabilityBySkuCode(skuCode);
  const branches = new Map<string, { id: string; code: string; name: string; available: number }>();
  for (const record of records) {
    const branch = record.location.warehouse.branch;
    const value = branches.get(branch.id) ?? { ...branch, available: 0 };
    value.available += record.availableQuantity;
    branches.set(branch.id, value);
  }
  const items: readonly BranchInventoryAvailabilityDto[] = [...branches.values()]
    .sort((left, right) => left.code.localeCompare(right.code))
    .map((branch) => ({ branchId: branch.id, branchCode: branch.code, branchName: branch.name, availability: inventoryAvailability(branch.available) }));
  const overallQuantity = [...branches.values()].reduce((sum, branch) => sum + branch.available, 0);
  return { skuCode, availability: inventoryAvailability(overallQuantity), branches: items };
}
