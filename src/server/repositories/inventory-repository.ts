import type { Prisma } from '@prisma/client';

import type {
  CreateBranchInput,
  CreateWarehouseInput,
  InventoryDeviceListQuery,
  InventoryPageQuery,
} from '@/modules/inventory/validators';
import type { AdminDatabaseClient } from '@/server/admin/database';
import { prisma } from '@/server/db/prisma';
import { ConflictError } from '@/server/errors/app-error';

const branchSelect = {
  id: true,
  code: true,
  name: true,
  kind: true,
  status: true,
  city: true,
  address: true,
  phone: true,
  isPickupEnabled: true,
  updatedAt: true,
  _count: { select: { warehouses: true } },
} satisfies Prisma.BranchSelect;

const inventoryLocationSelect = {
  id: true,
  warehouseId: true,
  code: true,
  name: true,
  type: true,
  status: true,
} satisfies Prisma.InventoryLocationSelect;

const warehouseSelect = {
  id: true,
  branchId: true,
  code: true,
  name: true,
  status: true,
  updatedAt: true,
  branch: { select: { id: true, code: true, name: true, status: true } },
  locations: { select: inventoryLocationSelect, orderBy: { code: 'asc' } },
  _count: { select: { locations: true } },
} satisfies Prisma.WarehouseSelect;

export const inventoryItemSelect = {
  id: true,
  warehouseId: true,
  locationId: true,
  skuId: true,
  quantity: true,
  reservedQuantity: true,
  availableQuantity: true,
  version: true,
  updatedAt: true,
  sku: {
    select: {
      id: true,
      code: true,
      barcode: true,
      variantId: true,
      inventoryPolicy: { select: { trackingMode: true } },
      variant: {
        select: {
          title: true,
          product: { select: { name: true, categoryId: true } },
        },
      },
    },
  },
  location: {
    select: {
      ...inventoryLocationSelect,
      warehouse: {
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          branch: { select: { id: true, code: true, name: true, status: true } },
        },
      },
    },
  },
} satisfies Prisma.InventoryItemSelect;

export type InventoryItemRecord = Prisma.InventoryItemGetPayload<{
  select: typeof inventoryItemSelect;
}>;

const stockMovementSelect = {
  id: true,
  skuId: true,
  quantity: true,
  type: true,
  adjustmentDirection: true,
  fromLocationId: true,
  toLocationId: true,
  reference: true,
  idempotencyKey: true,
  createdAt: true,
  sku: { select: { code: true } },
} satisfies Prisma.StockMovementSelect;

export type StockMovementRecord = Prisma.StockMovementGetPayload<{
  select: typeof stockMovementSelect;
}>;

const operationalSkuSelect = {
  id: true,
  code: true,
  variantId: true,
  status: true,
  deletedAt: true,
  inventoryPolicy: { select: { trackingMode: true } },
} satisfies Prisma.ProductSkuSelect;

const skuPolicySelect = {
  id: true,
  code: true,
  variantId: true,
  inventoryPolicy: { select: { trackingMode: true } },
} satisfies Prisma.ProductSkuSelect;

export type OperationalSkuRecord = Prisma.ProductSkuGetPayload<{
  select: typeof operationalSkuSelect;
}>;

export type SkuPolicyRecord = Prisma.ProductSkuGetPayload<{
  select: typeof skuPolicySelect;
}>;

const deviceUnitSelect = {
  id: true,
  skuId: true,
  inventoryItemId: true,
  imei: true,
  serialNumber: true,
  status: true,
  warrantyExpiresAt: true,
  createdAt: true,
  updatedAt: true,
  sku: { select: { code: true } },
  inventoryItem: {
    select: {
      location: {
        select: {
          warehouse: {
            select: {
              branch: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.DeviceUnitSelect;

export type DeviceUnitRecord = Prisma.DeviceUnitGetPayload<{
  select: typeof deviceUnitSelect;
}>;

export type BranchRecord = Prisma.BranchGetPayload<{ select: typeof branchSelect }>;
export type WarehouseRecord = Prisma.WarehouseGetPayload<{ select: typeof warehouseSelect }>;
export type InventoryLocationRecord = Prisma.InventoryLocationGetPayload<{ select: typeof inventoryLocationSelect }>;

function inventoryItemWhere(query: InventoryPageQuery): Prisma.InventoryItemWhereInput {
  const availability = query.availability === undefined
    ? {}
    : query.availability === 'AVAILABLE'
      ? { availableQuantity: { gt: 2 } }
      : query.availability === 'LIMITED'
        ? { availableQuantity: { gte: 1, lte: 2 } }
        : { availableQuantity: 0 };

  const conditions: Prisma.InventoryItemWhereInput[] = [availability];
  if (query.warehouseId !== undefined) conditions.push({ warehouseId: query.warehouseId });
  if (query.locationId !== undefined) conditions.push({ locationId: query.locationId });
  if (query.branchId !== undefined) {
    conditions.push({ location: { is: { warehouse: { is: { branchId: query.branchId } } } } });
  }
  if (query.sku !== undefined) conditions.push({ sku: { is: { code: query.sku } } });
  if (query.categoryId !== undefined) {
    conditions.push({ sku: { is: { variant: { is: { product: { is: { categoryId: query.categoryId } } } } } } });
  }
  if (query.query !== undefined) {
    conditions.push({ sku: { is: { code: { contains: query.query, mode: 'insensitive' } } } });
  }
  return conditions.length === 1 && Object.keys(conditions[0] ?? {}).length === 0 ? {} : { AND: conditions };
}

function deviceUnitWhere(query: InventoryDeviceListQuery): Prisma.DeviceUnitWhereInput {
  return {
    ...(query.sku === undefined ? {} : { sku: { is: { code: query.sku } } }),
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(query.branchId === undefined ? {} : { inventoryItem: { is: { location: { is: { warehouse: { is: { branchId: query.branchId } } } } } } }),
    ...(query.query === undefined
      ? {}
      : {
        OR: [
          { imei: { contains: query.query } },
          { serialNumber: { contains: query.query, mode: 'insensitive' } },
        ],
      }),
  };
}

export const inventoryRepository = {
  async findBranchPage(
    input: Readonly<{ page: number; pageSize: number; branchId?: string }>,
    client: AdminDatabaseClient = prisma,
  ): Promise<Readonly<{ items: readonly BranchRecord[]; total: number }>> {
    const where: Prisma.BranchWhereInput = input.branchId === undefined ? {} : { id: input.branchId };
    const [items, total] = await Promise.all([
      client.branch.findMany({ where, skip: (input.page - 1) * input.pageSize, take: input.pageSize, orderBy: { code: 'asc' }, select: branchSelect }),
      client.branch.count({ where }),
    ]);
    return { items, total };
  },

  findBranchById(id: string, client: AdminDatabaseClient = prisma): Promise<BranchRecord | null> {
    return client.branch.findUnique({ where: { id }, select: branchSelect });
  },

  createBranch(input: CreateBranchInput, client: AdminDatabaseClient): Promise<BranchRecord> {
    return client.branch.create({
      data: {
        code: input.code,
        name: input.name,
        kind: input.kind,
        status: input.status,
        city: input.city ?? null,
        address: input.address ?? null,
        phone: input.phone ?? null,
        isActive: input.status === 'ACTIVE',
        isPickupEnabled: input.isPickupEnabled,
      },
      select: branchSelect,
    });
  },

  updateBranch(
    id: string,
    data: Prisma.BranchUpdateInput,
    client: AdminDatabaseClient,
  ): Promise<BranchRecord> {
    return client.branch.update({ where: { id }, data, select: branchSelect });
  },

  async findWarehousePage(
    input: Readonly<{ page: number; pageSize: number; branchId?: string }>,
    client: AdminDatabaseClient = prisma,
  ): Promise<Readonly<{ items: readonly WarehouseRecord[]; total: number }>> {
    const where: Prisma.WarehouseWhereInput = input.branchId === undefined ? {} : { branchId: input.branchId };
    const [items, total] = await Promise.all([
      client.warehouse.findMany({ where, skip: (input.page - 1) * input.pageSize, take: input.pageSize, orderBy: [{ branch: { code: 'asc' } }, { code: 'asc' }], select: warehouseSelect }),
      client.warehouse.count({ where }),
    ]);
    return { items, total };
  },

  findWarehouseById(id: string, client: AdminDatabaseClient = prisma): Promise<WarehouseRecord | null> {
    return client.warehouse.findUnique({ where: { id }, select: warehouseSelect });
  },

  createWarehouse(input: CreateWarehouseInput, client: AdminDatabaseClient): Promise<WarehouseRecord> {
    return client.warehouse.create({
      data: {
        branchId: input.branchId,
        code: input.code,
        name: input.name,
        status: input.status,
        locations: { create: input.locations },
      },
      select: warehouseSelect,
    });
  },

  updateWarehouse(
    id: string,
    data: Prisma.WarehouseUpdateInput,
    client: AdminDatabaseClient,
  ): Promise<WarehouseRecord> {
    return client.warehouse.update({ where: { id }, data, select: warehouseSelect });
  },

  async findInventoryPage(
    query: InventoryPageQuery,
    client: AdminDatabaseClient = prisma,
  ): Promise<Readonly<{ items: readonly InventoryItemRecord[]; total: number }>> {
    const where = inventoryItemWhere(query);
    const [items, total] = await Promise.all([
      client.inventoryItem.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        select: inventoryItemSelect,
      }),
      client.inventoryItem.count({ where }),
    ]);
    return { items, total };
  },

  findInventoryItemById(id: string, client: AdminDatabaseClient = prisma): Promise<InventoryItemRecord | null> {
    return client.inventoryItem.findUnique({ where: { id }, select: inventoryItemSelect });
  },

  findInventoryItemByLocationSku(
    locationId: string,
    skuId: string,
    client: AdminDatabaseClient,
  ): Promise<InventoryItemRecord | null> {
    return client.inventoryItem.findUnique({ where: { locationId_skuId: { locationId, skuId } }, select: inventoryItemSelect });
  },

  findLocationById(
    id: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<(InventoryLocationRecord & { warehouse: { id: string; branchId: string; status: string; branch: { id: string; status: string } } }) | null> {
    return client.inventoryLocation.findUnique({
      where: { id },
      select: {
        ...inventoryLocationSelect,
        warehouse: { select: { id: true, branchId: true, status: true, branch: { select: { id: true, status: true } } } },
      },
    });
  },

  findSkuByCode(
    code: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<OperationalSkuRecord | null> {
    return client.productSku.findUnique({
      where: { code },
      select: operationalSkuSelect,
    });
  },

  findSkuById(
    id: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<SkuPolicyRecord | null> {
    return client.productSku.findUnique({
      where: { id },
      select: skuPolicySelect,
    });
  },

  findMovementByIdempotencyKey(key: string, client: AdminDatabaseClient): Promise<StockMovementRecord | null> {
    return client.stockMovement.findUnique({ where: { idempotencyKey: key }, select: stockMovementSelect });
  },

  createInventoryItem(
    data: Prisma.InventoryItemUncheckedCreateInput,
    client: AdminDatabaseClient,
  ): Promise<InventoryItemRecord> {
    return client.inventoryItem.create({ data, select: inventoryItemSelect });
  },

  updateInventoryItemWithVersion(
    id: string,
    version: number,
    data: Prisma.InventoryItemUpdateManyMutationInput,
    client: AdminDatabaseClient,
  ) {
    return client.inventoryItem.updateMany({ where: { id, version }, data });
  },

  createMovement(
    data: Prisma.StockMovementUncheckedCreateInput,
    client: AdminDatabaseClient,
  ): Promise<StockMovementRecord> {
    return client.stockMovement.create({ data, select: stockMovementSelect });
  },

  createDeviceUnits(
    data: readonly Prisma.DeviceUnitUncheckedCreateInput[],
    client: AdminDatabaseClient,
  ) {
    return client.deviceUnit.createMany({ data: [...data], skipDuplicates: false });
  },

  async reserveAvailableDeviceUnits(
    input: Readonly<{
      deviceUnitIds: readonly string[];
      skuId: string;
      inventoryItemId: string;
      reservationId: string;
    }>,
    client: AdminDatabaseClient,
  ): Promise<void> {
    const result = await client.deviceUnit.updateMany({
      where: {
        id: { in: [...input.deviceUnitIds] },
        skuId: input.skuId,
        inventoryItemId: input.inventoryItemId,
        reservationId: null,
        status: 'AVAILABLE',
      },
      data: { reservationId: input.reservationId, status: 'RESERVED' },
    });
    if (result.count !== input.deviceUnitIds.length) throw new ConflictError();
  },

  async releaseReservedDeviceUnits(
    reservationId: string,
    expectedCount: number,
    client: AdminDatabaseClient,
  ): Promise<void> {
    const result = await client.deviceUnit.updateMany({
      where: { reservationId, status: 'RESERVED' },
      data: { reservationId: null, status: 'AVAILABLE' },
    });
    if (result.count !== expectedCount) throw new ConflictError();
  },

  async transferAvailableDeviceUnits(
    input: Readonly<{
      deviceUnitIds: readonly string[];
      skuId: string;
      fromInventoryItemId: string;
      toInventoryItemId: string;
    }>,
    client: AdminDatabaseClient,
  ): Promise<void> {
    const result = await client.deviceUnit.updateMany({
      where: {
        id: { in: [...input.deviceUnitIds] },
        skuId: input.skuId,
        inventoryItemId: input.fromInventoryItemId,
        reservationId: null,
        status: 'AVAILABLE',
      },
      data: { inventoryItemId: input.toInventoryItemId },
    });
    if (result.count !== input.deviceUnitIds.length) throw new ConflictError();
  },

  upsertSkuPolicy(
    skuId: string,
    trackingMode: 'NONE' | 'SERIAL' | 'IMEI' | 'SERIAL_AND_IMEI',
    client: AdminDatabaseClient,
  ) {
    return client.inventorySkuPolicy.upsert({
      where: { skuId },
      create: { skuId, trackingMode },
      update: { trackingMode },
      select: { skuId: true, trackingMode: true },
    });
  },

  findReservationByIdempotencyKey(key: string, client: AdminDatabaseClient) {
    return client.inventoryReservation.findUnique({
      where: { idempotencyKey: key },
      select: { id: true, inventoryItemId: true, quantity: true, status: true, reference: true, expiresAt: true },
    });
  },

  findReservationById(id: string, client: AdminDatabaseClient) {
    return client.inventoryReservation.findUnique({
      where: { id },
      select: { id: true, inventoryItemId: true, quantity: true, status: true, reference: true, expiresAt: true },
    });
  },

  createReservation(
    data: Prisma.InventoryReservationUncheckedCreateInput,
    client: AdminDatabaseClient,
  ) {
    return client.inventoryReservation.create({
      data,
      select: { id: true, inventoryItemId: true, quantity: true, status: true, reference: true, expiresAt: true },
    });
  },

  releaseReservationIfActive(id: string, client: AdminDatabaseClient) {
    return client.inventoryReservation.updateMany({
      where: { id, status: 'ACTIVE' },
      data: { status: 'RELEASED' },
    });
  },

  countDeviceUnitsBySku(skuId: string, client: AdminDatabaseClient = prisma) {
    return client.deviceUnit.count({ where: { skuId } });
  },

  async findDeviceUnitPage(
    query: InventoryDeviceListQuery,
    client: AdminDatabaseClient = prisma,
  ): Promise<Readonly<{ items: readonly DeviceUnitRecord[]; total: number }>> {
    const where = deviceUnitWhere(query);
    const [items, total] = await Promise.all([
      client.deviceUnit.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        select: deviceUnitSelect,
      }),
      client.deviceUnit.count({ where }),
    ]);
    return { items, total };
  },

  async dashboard(
    branchId: string | undefined,
    client: AdminDatabaseClient = prisma,
  ) {
    const where: Prisma.InventoryItemWhereInput = branchId === undefined
      ? {}
      : { location: { is: { warehouse: { is: { branchId } } } } };
    const [balances, skuGroups, branchCount, damaged] = await Promise.all([
      client.inventoryItem.aggregate({ where, _sum: { quantity: true, availableQuantity: true, reservedQuantity: true } }),
      client.inventoryItem.groupBy({ by: ['skuId'], where: { AND: [where, { quantity: { gt: 0 } }] } }),
      client.branch.count({ where: branchId === undefined ? { status: 'ACTIVE' } : { id: branchId } }),
      client.inventoryItem.aggregate({
        where: { AND: [where, { location: { is: { type: 'DAMAGED' } } }] },
        _sum: { quantity: true },
      }),
    ]);
    return { balances, skuCount: skuGroups.length, branchCount, damaged };
  },

  async listAvailabilityBySkuCode(
    skuCode: string,
    client: AdminDatabaseClient = prisma,
  ) {
    return client.inventoryItem.findMany({
      where: {
        sku: { is: { code: skuCode } },
        location: { is: { status: 'ACTIVE', warehouse: { is: { status: 'ACTIVE', branch: { is: { status: 'ACTIVE' } } } } } },
      },
      select: {
        availableQuantity: true,
        location: { select: { warehouse: { select: { branch: { select: { id: true, code: true, name: true } } } } } },
      },
    });
  },

  async updateLegacyBranchProjection(
    input: Readonly<{ branchId: string; variantId: string; onHandDelta?: number; reservedDelta?: number }>,
    client: AdminDatabaseClient,
  ): Promise<void> {
    const onHandDelta = input.onHandDelta ?? 0;
    const reservedDelta = input.reservedDelta ?? 0;
    if (onHandDelta === 0 && reservedDelta === 0) return;
    const where = { branchId_variantId: { branchId: input.branchId, variantId: input.variantId } };
    const existing = await client.branchInventory.findUnique({ where, select: { onHand: true, reserved: true } });
    const nextOnHand = (existing?.onHand ?? 0) + onHandDelta;
    const nextReserved = (existing?.reserved ?? 0) + reservedDelta;
    if (nextOnHand < 0 || nextReserved < 0 || nextReserved > nextOnHand) {
      throw new ConflictError();
    }
    if (!existing) {
      await client.branchInventory.create({
        data: { branchId: input.branchId, variantId: input.variantId, onHand: nextOnHand, reserved: nextReserved },
      });
      return;
    }
    await client.branchInventory.update({
      where,
      data: { onHand: nextOnHand, reserved: nextReserved },
    });
  },
};
