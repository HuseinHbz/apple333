import type { Prisma } from "@prisma/client";

import type { OrderInventoryCandidate } from "@/server/repositories/order-repository";
import { inventoryRepository } from "@/server/repositories/inventory-repository";

type Transaction = Prisma.TransactionClient;

export class OrderInventoryError extends Error {
  public constructor(
    public readonly code:
      | "INVENTORY_UNAVAILABLE"
      | "RESERVATION_CONFLICT"
      | "INVALID_ALLOCATION",
    message: string,
  ) {
    super(message);
    this.name = "OrderInventoryError";
  }
}

export type OrderInventoryLine = Readonly<{
  variantId: string;
  quantity: number;
}>;

export type PlannedOrderAllocation = Readonly<{
  variantId: string;
  quantity: number;
  inventoryItem: OrderInventoryCandidate;
}>;

export type SingleBranchAllocationPlan = Readonly<{
  branchId: string;
  warehouseId: string;
  allocations: readonly PlannedOrderAllocation[];
}>;

export type ReservedOrderInventory = Readonly<{
  reservationId: string;
  branchId: string;
  warehouseId: string;
  inventoryItemId: string;
  quantity: number;
  /** Immutable evidence needed to link tracked units to this OMS allocation. */
  trackedDeviceUnits: readonly Readonly<{
    deviceUnitId: string;
    imei: string | null;
    serialNumber: string | null;
  }>[];
}>;

function sortCandidates(
  left: OrderInventoryCandidate,
  right: OrderInventoryCandidate,
): number {
  const branch = left.location.warehouse.branch.code.localeCompare(
    right.location.warehouse.branch.code,
  );
  if (branch !== 0) return branch;
  const availability = right.availableQuantity - left.availableQuantity;
  return availability !== 0 ? availability : left.id.localeCompare(right.id);
}

/**
 * v1 deliberately selects one branch that can fulfill every line. We avoid
 * implicit cross-branch or cross-location split allocation while that policy
 * remains feature-flagged off.
 */
export function planSingleBranchAllocation(
  lines: readonly OrderInventoryLine[],
  candidates: readonly OrderInventoryCandidate[],
  pickupBranchId: string | undefined,
): SingleBranchAllocationPlan {
  if (lines.length === 0) {
    throw new OrderInventoryError(
      "INVALID_ALLOCATION",
      "At least one order line is required for allocation.",
    );
  }

  const byBranch = new Map<string, OrderInventoryCandidate[]>();
  for (const candidate of candidates) {
    const branchId = candidate.location.warehouse.branch.id;
    if (pickupBranchId !== undefined && branchId !== pickupBranchId) continue;
    const entries = byBranch.get(branchId) ?? [];
    entries.push(candidate);
    byBranch.set(branchId, entries);
  }

  const orderedBranches = [...byBranch.entries()].sort(
    ([leftId, left], [rightId, right]) => {
      const byCode = (
        left[0]?.location.warehouse.branch.code ?? leftId
      ).localeCompare(right[0]?.location.warehouse.branch.code ?? rightId);
      return byCode !== 0 ? byCode : leftId.localeCompare(rightId);
    },
  );

  for (const [branchId, branchCandidates] of orderedBranches) {
    const allocations: PlannedOrderAllocation[] = [];
    let valid = true;
    for (const line of lines) {
      const selected = branchCandidates
        .filter(
          (candidate) =>
            candidate.sku.variantId === line.variantId &&
            candidate.availableQuantity >= line.quantity,
        )
        .sort(sortCandidates)[0];
      if (!selected) {
        valid = false;
        break;
      }
      allocations.push({
        variantId: line.variantId,
        quantity: line.quantity,
        inventoryItem: selected,
      });
    }
    if (valid && allocations.length === lines.length) {
      const warehouseId = allocations[0]?.inventoryItem.warehouseId;
      if (
        !warehouseId ||
        allocations.some(
          (allocation) => allocation.inventoryItem.warehouseId !== warehouseId,
        )
      ) {
        // Split warehouses are intentionally not enabled in v1. This keeps
        // pickup and operational handoff deterministic.
        continue;
      }
      return { branchId, warehouseId, allocations };
    }
  }

  throw new OrderInventoryError(
    "INVENTORY_UNAVAILABLE",
    "No active branch can fulfill the complete order.",
  );
}

async function currentInventoryItem(
  inventoryItemId: string,
  transaction: Transaction,
) {
  const item = await inventoryRepository.findInventoryItemById(
    inventoryItemId,
    transaction,
  );
  if (!item) {
    throw new OrderInventoryError(
      "INVALID_ALLOCATION",
      "The selected inventory item no longer exists.",
    );
  }
  return item;
}

function trackingModeOf(
  item: Awaited<ReturnType<typeof currentInventoryItem>>,
) {
  return item.sku.inventoryPolicy?.trackingMode ?? "NONE";
}

async function reserveTrackedUnits(
  input: Readonly<{
    inventoryItemId: string;
    skuId: string;
    reservationId: string;
    quantity: number;
  }>,
  transaction: Transaction,
): Promise<
  readonly Readonly<{
    deviceUnitId: string;
    imei: string | null;
    serialNumber: string | null;
  }>[]
> {
  const selected = await transaction.deviceUnit.findMany({
    where: {
      inventoryItemId: input.inventoryItemId,
      skuId: input.skuId,
      reservationId: null,
      status: "AVAILABLE",
    },
    orderBy: { id: "asc" },
    take: input.quantity,
    select: { id: true, imei: true, serialNumber: true },
  });
  if (selected.length !== input.quantity) {
    throw new OrderInventoryError(
      "INVENTORY_UNAVAILABLE",
      "Not enough tracked device units are available.",
    );
  }
  const updated = await transaction.deviceUnit.updateMany({
    where: {
      id: { in: selected.map((unit) => unit.id) },
      inventoryItemId: input.inventoryItemId,
      skuId: input.skuId,
      reservationId: null,
      status: "AVAILABLE",
    },
    data: { reservationId: input.reservationId, status: "RESERVED" },
  });
  if (updated.count !== input.quantity) {
    throw new OrderInventoryError(
      "RESERVATION_CONFLICT",
      "A tracked device was reserved concurrently.",
    );
  }
  return selected.map((unit) => ({
    deviceUnitId: unit.id,
    imei: unit.imei,
    serialNumber: unit.serialNumber,
  }));
}

export async function reserveOrderInventory(
  input: Readonly<{
    orderId: string;
    orderNumber: string;
    orderItemId: string;
    allocation: PlannedOrderAllocation;
    actorId?: string;
    expiresAt: Date;
  }>,
  transaction: Transaction,
): Promise<ReservedOrderInventory> {
  const item = await currentInventoryItem(
    input.allocation.inventoryItem.id,
    transaction,
  );
  if (
    item.sku.variantId !== input.allocation.variantId ||
    item.availableQuantity < input.allocation.quantity
  ) {
    throw new OrderInventoryError(
      "INVENTORY_UNAVAILABLE",
      "Inventory is no longer available for this order line.",
    );
  }

  const balance = await transaction.inventoryItem.updateMany({
    where: {
      id: item.id,
      version: item.version,
      availableQuantity: { gte: input.allocation.quantity },
    },
    data: {
      reservedQuantity: { increment: input.allocation.quantity },
      availableQuantity: { decrement: input.allocation.quantity },
      version: { increment: 1 },
    },
  });
  if (balance.count !== 1) {
    throw new OrderInventoryError(
      "RESERVATION_CONFLICT",
      "Inventory changed while the order was being reserved.",
    );
  }

  const reservation = await transaction.inventoryReservation.create({
    data: {
      inventoryItemId: item.id,
      quantity: input.allocation.quantity,
      status: "ACTIVE",
      expiresAt: input.expiresAt,
      reference: `order:${input.orderNumber}:item:${input.orderItemId}`,
      idempotencyKey: `order-reservation:${input.orderId}:${input.orderItemId}`,
      ...(input.actorId === undefined ? {} : { createdById: input.actorId }),
    },
    select: { id: true },
  });

  const trackedDeviceUnits =
    trackingModeOf(item) === "NONE"
      ? []
      : await reserveTrackedUnits(
          {
            inventoryItemId: item.id,
            skuId: item.skuId,
            reservationId: reservation.id,
            quantity: input.allocation.quantity,
          },
          transaction,
        );

  await transaction.stockMovement.create({
    data: {
      skuId: item.skuId,
      fromLocationId: item.locationId,
      quantity: input.allocation.quantity,
      type: "SALE_RESERVED",
      adjustmentDirection: "DECREASE",
      reference: `order:${input.orderNumber}`,
      idempotencyKey: `order-reservation-movement:${input.orderId}:${input.orderItemId}`,
      ...(input.actorId === undefined ? {} : { performedById: input.actorId }),
      metadata: {
        orderId: input.orderId,
        orderItemId: input.orderItemId,
        reservationId: reservation.id,
      },
    },
  });
  await inventoryRepository.synchronizeSellableBranchProjection(
    {
      branchId: item.location.warehouse.branch.id,
      variantId: item.sku.variantId,
    },
    transaction,
  );

  return {
    reservationId: reservation.id,
    branchId: item.location.warehouse.branch.id,
    warehouseId: item.warehouseId,
    inventoryItemId: item.id,
    quantity: input.allocation.quantity,
    trackedDeviceUnits,
  };
}

async function updateReservedBalance(
  item: Awaited<ReturnType<typeof currentInventoryItem>>,
  quantity: number,
  change: "RELEASE" | "CONSUME",
  transaction: Transaction,
): Promise<void> {
  const result = await transaction.inventoryItem.updateMany({
    where: {
      id: item.id,
      version: item.version,
      reservedQuantity: { gte: quantity },
      ...(change === "CONSUME" ? { quantity: { gte: quantity } } : {}),
    },
    data:
      change === "RELEASE"
        ? {
            reservedQuantity: { decrement: quantity },
            availableQuantity: { increment: quantity },
            version: { increment: 1 },
          }
        : {
            quantity: { decrement: quantity },
            reservedQuantity: { decrement: quantity },
            version: { increment: 1 },
          },
  });
  if (result.count !== 1) {
    throw new OrderInventoryError(
      "RESERVATION_CONFLICT",
      "Reserved inventory changed before it could be reconciled.",
    );
  }
}

async function releaseOrConsumeTrackedUnits(
  input: Readonly<{
    reservationId: string;
    quantity: number;
    mode: "RELEASE" | "CONSUME";
  }>,
  transaction: Transaction,
): Promise<void> {
  const count = await transaction.deviceUnit.count({
    where: { reservationId: input.reservationId, status: "RESERVED" },
  });
  if (count === 0) return;
  if (count !== input.quantity) {
    throw new OrderInventoryError(
      "RESERVATION_CONFLICT",
      "Tracked reservation evidence is inconsistent.",
    );
  }
  const result = await transaction.deviceUnit.updateMany({
    where: { reservationId: input.reservationId, status: "RESERVED" },
    data:
      input.mode === "RELEASE"
        ? { reservationId: null, status: "AVAILABLE" }
        : { status: "SOLD" },
  });
  if (result.count !== input.quantity) {
    throw new OrderInventoryError(
      "RESERVATION_CONFLICT",
      "A tracked reservation changed concurrently.",
    );
  }
}

export async function releaseOrderInventory(
  input: Readonly<{
    orderId: string;
    orderNumber: string;
    orderItemId: string;
    reservationId: string;
    inventoryItemId: string;
    quantity: number;
    actorId?: string;
    /**
     * Expiration returns the physical inventory exactly like a cancellation,
     * but retains the distinct reservation outcome for reconciliation and
     * customer-service investigation.
     */
    releaseStatus?: "RELEASED" | "EXPIRED";
  }>,
  transaction: Transaction,
): Promise<void> {
  const reservation = await transaction.inventoryReservation.findUnique({
    where: { id: input.reservationId },
    select: { id: true, status: true, inventoryItemId: true, quantity: true },
  });
  if (
    !reservation ||
    reservation.inventoryItemId !== input.inventoryItemId ||
    reservation.quantity !== input.quantity
  ) {
    throw new OrderInventoryError(
      "INVALID_ALLOCATION",
      "The order allocation no longer matches its reservation.",
    );
  }
  const releaseStatus = input.releaseStatus ?? "RELEASED";
  if (reservation.status === releaseStatus) return;
  if (reservation.status !== "ACTIVE") {
    throw new OrderInventoryError(
      "RESERVATION_CONFLICT",
      "Only an active order reservation can be released.",
    );
  }

  const item = await currentInventoryItem(input.inventoryItemId, transaction);
  await updateReservedBalance(item, input.quantity, "RELEASE", transaction);
  await releaseOrConsumeTrackedUnits(
    {
      reservationId: reservation.id,
      quantity: input.quantity,
      mode: "RELEASE",
    },
    transaction,
  );
  const released = await transaction.inventoryReservation.updateMany({
    where: { id: reservation.id, status: "ACTIVE" },
    data: { status: releaseStatus },
  });
  if (released.count !== 1) {
    throw new OrderInventoryError(
      "RESERVATION_CONFLICT",
      "Reservation status changed while releasing the order.",
    );
  }
  await transaction.stockMovement.create({
    data: {
      skuId: item.skuId,
      toLocationId: item.locationId,
      quantity: input.quantity,
      type: "SALE_RESERVED",
      adjustmentDirection: "INCREASE",
      reference: `order:${input.orderNumber}`,
      idempotencyKey:
        releaseStatus === "EXPIRED"
          ? `order-reservation-expire:${input.orderId}:${input.orderItemId}`
          : `order-reservation-release:${input.orderId}:${input.orderItemId}`,
      ...(input.actorId === undefined ? {} : { performedById: input.actorId }),
      metadata: {
        orderId: input.orderId,
        orderItemId: input.orderItemId,
        reservationId: reservation.id,
      },
    },
  });
  await inventoryRepository.synchronizeSellableBranchProjection(
    {
      branchId: item.location.warehouse.branch.id,
      variantId: item.sku.variantId,
    },
    transaction,
  );
}

export async function consumeOrderInventory(
  input: Readonly<{
    orderId: string;
    orderNumber: string;
    orderItemId: string;
    reservationId: string;
    inventoryItemId: string;
    quantity: number;
    actorId?: string;
  }>,
  transaction: Transaction,
): Promise<void> {
  const reservation = await transaction.inventoryReservation.findUnique({
    where: { id: input.reservationId },
    select: { id: true, status: true, inventoryItemId: true, quantity: true },
  });
  if (
    !reservation ||
    reservation.inventoryItemId !== input.inventoryItemId ||
    reservation.quantity !== input.quantity
  ) {
    throw new OrderInventoryError(
      "INVALID_ALLOCATION",
      "The order allocation no longer matches its reservation.",
    );
  }
  if (reservation.status === "FULFILLED") return;
  if (reservation.status !== "ACTIVE") {
    throw new OrderInventoryError(
      "RESERVATION_CONFLICT",
      "Only an active reservation can be consumed.",
    );
  }

  const item = await currentInventoryItem(input.inventoryItemId, transaction);
  await updateReservedBalance(item, input.quantity, "CONSUME", transaction);
  await releaseOrConsumeTrackedUnits(
    {
      reservationId: reservation.id,
      quantity: input.quantity,
      mode: "CONSUME",
    },
    transaction,
  );
  const fulfilled = await transaction.inventoryReservation.updateMany({
    where: { id: reservation.id, status: "ACTIVE" },
    data: { status: "FULFILLED" },
  });
  if (fulfilled.count !== 1) {
    throw new OrderInventoryError(
      "RESERVATION_CONFLICT",
      "Reservation status changed while consuming the order.",
    );
  }
  await transaction.stockMovement.create({
    data: {
      skuId: item.skuId,
      fromLocationId: item.locationId,
      quantity: input.quantity,
      type: "SALE_FULFILLED",
      adjustmentDirection: "DECREASE",
      reference: `order:${input.orderNumber}`,
      idempotencyKey: `order-fulfillment-movement:${input.orderId}:${input.orderItemId}`,
      ...(input.actorId === undefined ? {} : { performedById: input.actorId }),
      metadata: {
        orderId: input.orderId,
        orderItemId: input.orderItemId,
        reservationId: reservation.id,
      },
    },
  });
  await inventoryRepository.synchronizeSellableBranchProjection(
    {
      branchId: item.location.warehouse.branch.id,
      variantId: item.sku.variantId,
    },
    transaction,
  );
}
