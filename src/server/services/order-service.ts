import { createHash, randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import {
  calculateOrderPricing,
  toOrderPricingSummaryDto,
  OrderPricingError,
} from "@/modules/orders/pricing";
import {
  assertOrderStatusTransition,
  OrderStateTransitionError,
} from "@/modules/orders/state-machine";
import type {
  OrderAddressSnapshot,
  OrderCustomerSnapshot,
  OrderDto,
  OrderItemCommercialSnapshot,
  OrderItemDto,
  OrderStatusHistoryDto,
} from "@/modules/orders/types";
import type {
  AllocateOrderInput,
  CancelOrderInput,
  ConfirmOrderInput,
  CreateAdminOrderInput,
  CreateOrderFromCartInput,
  CreateOrderFulfillmentInput,
  CreateOrderNoteInput,
  OrderListQuery,
  RecordOrderPaymentInput,
} from "@/modules/orders/validators";
import { toPage } from "@/server/admin/pagination";
import type { Page } from "@/server/admin/types";
import { prisma } from "@/server/db/prisma";
import { AppError, AuthorizationError } from "@/server/errors/app-error";
import {
  recordOrderCommand,
  recordOrderLifecycleEvent,
  type OrderMetricOperation,
} from "@/server/monitoring/metrics";
import {
  orderRepository,
  type OrderAddressRecord,
  type OrderCatalogVariant,
  type OrderCustomerRecord,
  type OrderDetailRecord,
  type OrderListRecord,
} from "@/server/repositories/order-repository";
import {
  consumeOrderInventory,
  OrderInventoryError,
  planSingleBranchAllocation,
  releaseOrderInventory,
  reserveOrderInventory,
} from "@/server/services/order-inventory-service";
import {
  hasPermission,
  requireOrderBranchAccess,
  requirePermission,
  resolveOrderBranchScope,
  type SessionActor,
} from "@/server/security/permissions";

type Transaction = Prisma.TransactionClient;

const ORDER_IDEMPOTENCY_RETENTION_MS = 1000 * 60 * 60 * 24;
const ORDER_RESERVATION_TTL_MS = 1000 * 60 * 15;
const ORDER_CONFIRMED_RESERVATION_TTL_MS = 1000 * 60 * 60 * 72;

export type OrderAuditContext = Readonly<{
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}>;

export type OrderDetailDto = OrderDto &
  Readonly<{
    items: readonly OrderItemDto[];
    timeline: readonly OrderStatusHistoryDto[];
    fulfillment: Readonly<{
      method: "PICKUP" | "DELIVERY";
      status: string;
      trackingCode: string | null;
      branch: Readonly<{ id: string; code: string; name: string }> | null;
      warehouse: Readonly<{ id: string; code: string; name: string }> | null;
      preparedAt: string | null;
      shippedAt: string | null;
      deliveredAt: string | null;
    }> | null;
    allocations: readonly Readonly<{
      id: string;
      orderItemId: string;
      branch: Readonly<{ id: string; code: string; name: string }>;
      warehouse: Readonly<{ id: string; code: string; name: string }>;
      quantity: number;
      status: string;
      reservationStatus: string | null;
      /** Full IMEI/serial values require `orders.view_imei`; otherwise empty. */
      deviceUnits: readonly Readonly<{
        id: string;
        imei: string | null;
        serialNumber: string | null;
        status: string;
      }>[];
    }>[];
    notes: readonly Readonly<{
      id: string;
      visibility: string;
      content: string;
      authorName: string | null;
      createdAt: string;
    }>[];
    payments: readonly Readonly<{
      id: string;
      provider: string;
      method: string;
      amountRials: string;
      status: string;
      providerReference: string | null;
      createdAt: string;
    }>[];
  }>;

export type OrderListItemDto = Readonly<{
  id: string;
  orderNumber: string;
  source: string;
  type: string;
  customerName: string | null;
  branchName: string | null;
  itemCount: number;
  /** Null when the caller does not have `orders.view_financials`. */
  grandTotalRials: string | null;
  paymentStatus: string;
  allocationStatus: string;
  fulfillmentStatus: string;
  status: string;
  version: number;
  createdAt: string;
}>;

export class OrderServiceError extends AppError {
  public constructor(
    code: string,
    status: number,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(code, status, message, fields);
    this.name = "OrderServiceError";
  }
}

function orderError(
  code: string,
  status: number,
  message: string,
  fields?: Record<string, string>,
): never {
  throw new OrderServiceError(code, status, message, fields);
}

function isPrismaError(
  error: unknown,
  code: string,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

function requestHash(value: unknown): string {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

function createOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `A33-${date}-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function actorType(actor: SessionActor): "CUSTOMER" | "ADMIN" {
  return actor.isAdmin ? "ADMIN" : "CUSTOMER";
}

function asJsonObject(
  value: Prisma.JsonValue | null,
): Readonly<Record<string, unknown>> {
  if (value === null || Array.isArray(value) || typeof value !== "object")
    return {};
  return value as Readonly<Record<string, unknown>>;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function customerSnapshotOf(
  record: OrderCustomerRecord,
): OrderCustomerSnapshot {
  if (!record.name && !record.email && !record.mobile) {
    orderError(
      "ORDER_VALIDATION_FAILED",
      400,
      "برای ثبت سفارش، مشخصات تماس مشتری باید کامل شود.",
      { customer: "Customer contact information is incomplete." },
    );
  }
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    mobile: record.mobile,
  };
}

function addressSnapshotOf(record: OrderAddressRecord): OrderAddressSnapshot {
  return {
    recipientName: record.recipientName,
    mobile: record.mobile,
    province: record.province,
    city: record.city,
    line1: record.line1,
    postalCode: record.postalCode,
  };
}

function itemSnapshotOf(
  variant: OrderCatalogVariant,
): OrderItemCommercialSnapshot {
  const sku = variant.skuRecord;
  if (
    !variant.isActive ||
    variant.deletedAt ||
    variant.product.status !== "PUBLISHED" ||
    variant.product.deletedAt ||
    !sku ||
    sku.status !== "ACTIVE" ||
    sku.deletedAt
  ) {
    orderError(
      "ORDER_PRICE_CHANGED",
      409,
      "یکی از کالاهای سبد دیگر برای سفارش قابل خرید نیست.",
    );
  }
  const warranty =
    variant.warrantyRecord &&
    variant.warrantyRecord.isActive &&
    !variant.warrantyRecord.deletedAt
      ? {
          code: variant.warrantyRecord.code,
          provider: variant.warrantyRecord.provider,
          name: variant.warrantyRecord.name,
          durationMonths: variant.warrantyRecord.durationMonths,
        }
      : null;
  return {
    productId: variant.product.id,
    variantId: variant.id,
    sku: sku.code,
    productName: variant.product.name,
    variantName: variant.title,
    warranty,
    attributes: asJsonObject(variant.attributes),
  };
}

function ensureOrderRecord(
  record: OrderDetailRecord | null,
): OrderDetailRecord {
  if (!record) orderError("ORDER_NOT_FOUND", 404, "سفارش موردنظر یافت نشد.");
  return record;
}

function toCustomerSnapshot(value: Prisma.JsonValue): OrderCustomerSnapshot {
  const record = asJsonObject(value);
  return {
    id: asNullableString(record.id),
    name: asNullableString(record.name),
    email: asNullableString(record.email),
    mobile: asNullableString(record.mobile),
  };
}

function toAddressSnapshot(
  value: Prisma.JsonValue | null,
): OrderAddressSnapshot | null {
  if (value === null) return null;
  const record = asJsonObject(value);
  const recipientName = asNullableString(record.recipientName);
  const mobile = asNullableString(record.mobile);
  const line1 = asNullableString(record.line1);
  if (!recipientName || !mobile || !line1) return null;
  return {
    recipientName,
    mobile,
    province: asNullableString(record.province),
    city: asNullableString(record.city),
    line1,
    postalCode: asNullableString(record.postalCode),
  };
}

function mapOrder(
  record: OrderDetailRecord,
  includePii: boolean,
  includeFinancial: boolean,
): OrderDto {
  return {
    id: record.id,
    orderNumber: record.orderNumber,
    source: record.source,
    type: record.type,
    customerId: includePii ? record.customerId : null,
    customer: includePii
      ? toCustomerSnapshot(record.customerSnapshot)
      : { id: null, name: null, email: null, mobile: null },
    billingAddress: includePii
      ? toAddressSnapshot(record.billingAddressSnapshot)
      : null,
    shippingAddress: includePii
      ? toAddressSnapshot(record.shippingAddressSnapshot)
      : null,
    fulfillmentMethod: record.fulfillmentMethod,
    pricing: includeFinancial
      ? toOrderPricingSummaryDto({
          currency: record.currency,
          lines: [],
          subtotalRials: record.subtotalRials,
          discountTotalRials: record.discountTotalRials,
          taxTotalRials: record.taxTotalRials,
          shippingTotalRials: record.shippingTotalRials,
          feeTotalRials: record.feeTotalRials,
          grandTotalRials: record.grandTotalRials,
        })
      : null,
    paymentStatus: record.paymentStatus,
    allocationStatus: record.allocationStatus,
    fulfillmentStatus: record.fulfillmentStatus,
    status: record.orderStatus,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Explicit projection boundary used by all OMS service responses. */
export function mapOrderDetail(
  record: OrderDetailRecord,
  includeInternal: boolean,
  includeFinancial: boolean,
  includePii: boolean,
  includeImei = false,
): OrderDetailDto {
  const base = mapOrder(record, includePii, includeFinancial);
  return {
    ...base,
    items: record.items.map((item) => ({
      id: item.id,
      snapshot: {
        productId: item.productId,
        variantId: item.variantId,
        sku: item.sku,
        productName: item.productName,
        variantName: item.variantName,
        warranty: item.warrantySnapshot
          ? (asJsonObject(
              item.warrantySnapshot,
            ) as OrderItemCommercialSnapshot["warranty"])
          : null,
        attributes: asJsonObject(item.attributesSnapshot),
      },
      quantity: item.quantity,
      unitPriceRials: includeFinancial ? item.unitPriceRials.toString() : null,
      discountAmountRials: includeFinancial
        ? item.discountAmountRials.toString()
        : null,
      taxAmountRials: includeFinancial ? item.taxAmountRials.toString() : null,
      lineTotalRials: includeFinancial ? item.lineTotalRials.toString() : null,
    })),
    timeline: record.statusHistory.map((entry) => ({
      id: entry.id,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      actorId: includeInternal ? entry.actorId : null,
      actorType: entry.actorType,
      reasonCode: includeInternal ? entry.reasonCode : null,
      note: includeInternal ? entry.note : null,
      createdAt: entry.createdAt.toISOString(),
    })),
    fulfillment: record.fulfillment
      ? {
          method: record.fulfillment.method,
          status: record.fulfillment.status,
          trackingCode: record.fulfillment.trackingCode,
          branch: record.fulfillment.branch,
          warehouse: record.fulfillment.warehouse,
          preparedAt: record.fulfillment.preparedAt?.toISOString() ?? null,
          shippedAt: record.fulfillment.shippedAt?.toISOString() ?? null,
          deliveredAt: record.fulfillment.deliveredAt?.toISOString() ?? null,
        }
      : null,
    allocations: includeInternal
      ? record.allocations.map((allocation) => ({
          id: allocation.id,
          orderItemId: allocation.orderItemId,
          branch: allocation.branch,
          warehouse: allocation.warehouse,
          quantity: allocation.quantity,
          status: allocation.status,
          reservationStatus: allocation.reservation?.status ?? null,
          deviceUnits: includeImei
            ? allocation.deviceAssignments.map((assignment) => ({
                id: assignment.deviceUnit.id,
                imei: assignment.imeiSnapshot,
                serialNumber: assignment.serialNumberSnapshot,
                status: assignment.status,
              }))
            : [],
        }))
      : [],
    notes: record.notes
      .filter((note) => includeInternal || note.visibility === "CUSTOMER")
      .map((note) => ({
        id: note.id,
        visibility: note.visibility,
        content: note.content,
        authorName: includeInternal ? note.author.name : null,
        createdAt: note.createdAt.toISOString(),
      })),
    payments: includeFinancial
      ? record.payments.map((payment) => ({
          id: payment.id,
          provider: payment.provider,
          method: payment.method,
          amountRials: payment.amountRials.toString(),
          status: payment.status,
          providerReference: payment.providerReference,
          createdAt: payment.createdAt.toISOString(),
        }))
      : [],
  };
}

/** Explicit list projection boundary; do not return raw repository records. */
export function mapOrderList(
  record: OrderListRecord,
  includePii: boolean,
  includeFinancial: boolean,
): OrderListItemDto {
  const customer = toCustomerSnapshot(record.customerSnapshot);
  return {
    id: record.id,
    orderNumber: record.orderNumber,
    source: record.source,
    type: record.type,
    customerName: includePii ? customer.name : null,
    branchName: record.allocations[0]?.branch.name ?? null,
    itemCount: record._count.items,
    grandTotalRials: includeFinancial
      ? record.grandTotalRials.toString()
      : null,
    paymentStatus: record.paymentStatus,
    allocationStatus: record.allocationStatus,
    fulfillmentStatus: record.fulfillmentStatus,
    status: record.orderStatus,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
  };
}

function writeAudit(
  transaction: Transaction,
  input: Readonly<{
    actor: SessionActor;
    context: OrderAuditContext;
    action: string;
    order: Readonly<{
      id: string;
      orderNumber: string;
      orderStatus: string;
      version: number;
    }>;
    reasonCode?: string | null;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
  }>,
) {
  return transaction.auditLog.create({
    data: {
      actorId: input.actor.id,
      actorType: actorType(input.actor),
      action: input.action,
      entityType: "Order",
      entityId: input.order.id,
      requestId: input.context.requestId,
      ...(input.reasonCode === undefined || input.reasonCode === null
        ? {}
        : { reasonCode: input.reasonCode }),
      ...(input.context.ipAddress === undefined
        ? {}
        : { ipAddress: input.context.ipAddress }),
      ...(input.context.userAgent === undefined
        ? {}
        : { userAgent: input.context.userAgent }),
      metadata: {
        orderNumber: input.order.orderNumber,
        status: input.order.orderStatus,
        version: input.order.version,
      },
      ...(input.before === undefined ? {} : { beforeSnapshot: input.before }),
      ...(input.after === undefined ? {} : { afterSnapshot: input.after }),
    },
  });
}

function writeOutboxEvent(
  transaction: Transaction,
  input: Readonly<{
    orderId: string;
    eventType: string;
    aggregateVersion: number;
    orderNumber: string;
    status: string;
    allocationStatus: string;
  }>,
) {
  return transaction.orderOutboxEvent.create({
    data: {
      orderId: input.orderId,
      eventType: input.eventType,
      aggregateVersion: input.aggregateVersion,
      payload: {
        orderNumber: input.orderNumber,
        status: input.status,
        allocationStatus: input.allocationStatus,
      },
    },
  });
}

function writeStatusHistory(
  transaction: Transaction,
  input: Readonly<{
    orderId: string;
    fromStatus:
      | "DRAFT"
      | "PENDING_CONFIRMATION"
      | "CONFIRMED"
      | "PROCESSING"
      | "COMPLETED"
      | "CANCELLED"
      | "REJECTED"
      | null;
    toStatus:
      | "DRAFT"
      | "PENDING_CONFIRMATION"
      | "CONFIRMED"
      | "PROCESSING"
      | "COMPLETED"
      | "CANCELLED"
      | "REJECTED";
    actor: SessionActor;
    context: OrderAuditContext;
    version: number;
    reasonCode?: string | null;
    note?: string | null;
  }>,
) {
  return transaction.orderStatusHistory.create({
    data: {
      orderId: input.orderId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorId: input.actor.id,
      actorType: actorType(input.actor),
      ...(input.reasonCode === undefined || input.reasonCode === null
        ? {}
        : { reasonCode: input.reasonCode }),
      ...(input.note === undefined || input.note === null
        ? {}
        : { note: input.note }),
      requestId: input.context.requestId,
      version: input.version,
    },
  });
}

/**
 * A rejected lifecycle command has no transaction to retain its normal audit
 * row. Record a minimal, redacted audit fact on the independent audit client
 * before rethrowing the domain rejection; the record never contains a free
 * form note, address, price, payment reference, IMEI, or serial number.
 */
async function recordRejectedOrderTransitionAudit(
  input: Readonly<{
    actor: SessionActor;
    context: OrderAuditContext;
    order: OrderDetailRecord;
    fromStatus: string | null;
    requestedStatus: string;
    error: unknown;
  }>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actor.id,
        actorType: actorType(input.actor),
        action: "order.transition.rejected",
        entityType: "Order",
        entityId: input.order.id,
        requestId: input.context.requestId,
        reasonCode:
          input.error instanceof OrderStateTransitionError
            ? input.error.code
            : "ORDER_INVALID_TRANSITION",
        ...(input.context.ipAddress === undefined
          ? {}
          : { ipAddress: input.context.ipAddress }),
        ...(input.context.userAgent === undefined
          ? {}
          : { userAgent: input.context.userAgent }),
        metadata: {
          orderNumber: input.order.orderNumber,
          fromStatus: input.fromStatus,
          requestedStatus: input.requestedStatus,
        },
      },
    });
  } catch {
    // The invalid command itself remains rejected even when diagnostics are
    // temporarily unavailable; do not turn a business-rule response into a
    // storage implementation detail.
  }
}

async function assertOrderStatusTransitionWithRejectionAudit(
  input: Readonly<{
    actor: SessionActor;
    context: OrderAuditContext;
    order: OrderDetailRecord;
    transition: Parameters<typeof assertOrderStatusTransition>[0];
  }>,
) {
  try {
    return assertOrderStatusTransition(input.transition);
  } catch (error) {
    await recordRejectedOrderTransitionAudit({
      actor: input.actor,
      context: input.context,
      order: input.order,
      fromStatus: input.transition.fromStatus,
      requestedStatus: input.transition.toStatus,
      error,
    });
    throw error;
  }
}

function mapKnownOrderError(error: unknown): never {
  if (error instanceof AppError) throw error;
  if (error instanceof OrderPricingError) {
    const code =
      error.code === "DISCOUNT_EXCEEDS_SUBTOTAL" ||
      error.code === "INVALID_MONEY"
        ? "ORDER_VALIDATION_FAILED"
        : "ORDER_PRICE_CHANGED";
    orderError(
      code,
      error.code === "INVALID_MONEY" ? 400 : 409,
      "مبلغ سفارش قابل تأیید نیست.",
    );
  }
  if (error instanceof OrderStateTransitionError) {
    orderError(
      error.code === "INVALID_TRANSITION"
        ? "ORDER_INVALID_TRANSITION"
        : "ORDER_CANCELLATION_NOT_ALLOWED",
      409,
      "تغییر وضعیت سفارش مجاز نیست.",
    );
  }
  if (error instanceof OrderInventoryError) {
    const code =
      error.code === "INVENTORY_UNAVAILABLE"
        ? "ORDER_INVENTORY_UNAVAILABLE"
        : "ORDER_RESERVATION_FAILED";
    orderError(code, 409, "موجودی سفارش در دسترس نیست.");
  }
  if (isPrismaError(error, "P2034"))
    orderError(
      "ORDER_VERSION_CONFLICT",
      409,
      "سفارش هم‌زمان تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.",
    );
  if (isPrismaError(error, "P2002"))
    orderError(
      "ORDER_DUPLICATE_REQUEST",
      409,
      "درخواست تکراری یا ناسازگار است.",
    );
  throw error;
}

async function runOrderTransaction<T>(
  callback: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isPrismaError(error, "P2034")) mapKnownOrderError(error);
      lastError = error;
    }
  }
  mapKnownOrderError(lastError);
}

async function replayIdempotentOrder(
  scope: string,
  key: string,
  hash: string,
): Promise<OrderDetailRecord | null> {
  const record = await orderRepository.findIdempotencyRecord(scope, key);
  if (!record) return null;
  if (record.requestHash !== hash) {
    orderError(
      "ORDER_IDEMPOTENCY_CONFLICT",
      409,
      "این کلید تکرار با درخواست دیگری استفاده شده است.",
    );
  }
  if (record.expiresAt.getTime() < Date.now()) {
    orderError(
      "ORDER_DUPLICATE_REQUEST",
      409,
      "کلید تکرار منقضی شده و قابل استفادهٔ مجدد نیست.",
    );
  }
  return ensureOrderRecord(
    record.orderId ? await orderRepository.findOrderById(record.orderId) : null,
  );
}

async function executeIdempotentOrderCommand(
  input: Readonly<{
    operation: OrderMetricOperation;
    scope: string;
    key: string;
    hash: string;
    execute: (transaction: Transaction) => Promise<OrderDetailRecord>;
    /** Invoked only after a newly committed command, never on an idempotent replay. */
    onCommitted?: (record: OrderDetailRecord) => void;
  }>,
): Promise<OrderDetailRecord> {
  const startedAt = Date.now();
  const recordCommand = (
    result: "success" | "failure" | "replay",
    error?: unknown,
  ): void => {
    try {
      recordOrderCommand(
        input.operation,
        result,
        Date.now() - startedAt,
        error instanceof AppError ? error.code : undefined,
      );
    } catch {
      // Observability must never change the outcome of an order command.
    }
  };
  const recordCommittedLifecycle = (record: OrderDetailRecord): void => {
    try {
      input.onCommitted?.(record);
    } catch {
      // A Prometheus client failure must not make a committed command fail.
    }
  };

  let replay: OrderDetailRecord | null;
  try {
    replay = await replayIdempotentOrder(input.scope, input.key, input.hash);
  } catch (error) {
    recordCommand("failure", error);
    mapKnownOrderError(error);
  }
  if (replay) {
    recordCommand("replay");
    return replay;
  }

  try {
    const record = await runOrderTransaction(input.execute);
    recordCommand("success");
    recordCommittedLifecycle(record);
    return record;
  } catch (error) {
    // `runOrderTransaction` converts database unique violations to a safe
    // domain error. A concurrent identical request can therefore surface as
    // either form; in both cases, retry the durable idempotency lookup before
    // returning an error. This makes retry behavior deterministic without
    // exposing a storage-specific failure to callers.
    if (
      isPrismaError(error, "P2002") ||
      (error instanceof OrderServiceError &&
        error.code === "ORDER_DUPLICATE_REQUEST")
    ) {
      const concurrentReplay = await replayIdempotentOrder(
        input.scope,
        input.key,
        input.hash,
      );
      if (concurrentReplay) {
        recordCommand("replay");
        return concurrentReplay;
      }
    }
    recordCommand("failure", error);
    mapKnownOrderError(error);
  }
}

async function assertOrderBranchScope(
  actor: SessionActor,
  record: OrderDetailRecord,
): Promise<void> {
  const scope = resolveOrderBranchScope(actor);
  if (scope === undefined) return;
  if (!record.allocations.some((allocation) => allocation.branchId === scope)) {
    throw new AuthorizationError();
  }
}

async function loadCustomerAndAddresses(
  input: Readonly<{
    customerId: string;
    billingAddressId?: string;
    shippingAddressId?: string;
  }>,
  transaction: Transaction,
): Promise<
  Readonly<{
    customer: OrderCustomerRecord;
    billingAddress: OrderAddressSnapshot | null;
    shippingAddress: OrderAddressSnapshot | null;
  }>
> {
  const customer = await orderRepository.findCustomerById(
    input.customerId,
    transaction,
  );
  if (!customer || customer.status !== "ACTIVE") {
    orderError(
      "ORDER_VALIDATION_FAILED",
      400,
      "حساب مشتری برای ثبت سفارش فعال نیست.",
    );
  }
  const [billing, shipping] = await Promise.all([
    input.billingAddressId === undefined
      ? Promise.resolve(null)
      : orderRepository.findAddressForCustomer(
          input.billingAddressId,
          customer.id,
          transaction,
        ),
    input.shippingAddressId === undefined
      ? Promise.resolve(null)
      : orderRepository.findAddressForCustomer(
          input.shippingAddressId,
          customer.id,
          transaction,
        ),
  ]);
  if (input.billingAddressId !== undefined && !billing)
    orderError("ORDER_VALIDATION_FAILED", 400, "نشانی صورتحساب معتبر نیست.");
  if (input.shippingAddressId !== undefined && !shipping)
    orderError("ORDER_VALIDATION_FAILED", 400, "نشانی ارسال معتبر نیست.");
  return {
    customer,
    billingAddress: billing ? addressSnapshotOf(billing) : null,
    shippingAddress: shipping ? addressSnapshotOf(shipping) : null,
  };
}

type RequestedLine = Readonly<{
  variantId: string;
  quantity: number;
  cartUnitPriceRials?: bigint | null;
}>;

async function createOrderDeviceAssignments(
  transaction: Transaction,
  input: Readonly<{
    orderId: string;
    orderItemId: string;
    orderAllocationId: string;
    reservationId: string;
    deviceUnits: readonly Readonly<{
      deviceUnitId: string;
      imei: string | null;
      serialNumber: string | null;
    }>[];
  }>,
): Promise<void> {
  if (input.deviceUnits.length === 0) return;
  await transaction.orderDeviceAssignment.createMany({
    data: input.deviceUnits.map((unit) => ({
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      orderAllocationId: input.orderAllocationId,
      reservationId: input.reservationId,
      deviceUnitId: unit.deviceUnitId,
      imeiSnapshot: unit.imei,
      serialNumberSnapshot: unit.serialNumber,
      status: "RESERVED",
    })),
  });
}

async function transitionOrderDeviceAssignments(
  transaction: Transaction,
  allocation: OrderDetailRecord["allocations"][number],
  status: "RELEASED" | "FULFILLED",
  now = new Date(),
): Promise<void> {
  if (allocation.deviceAssignments.length === 0) return;
  const updated = await transaction.orderDeviceAssignment.updateMany({
    where: {
      orderAllocationId: allocation.id,
      status: "RESERVED",
    },
    data:
      status === "RELEASED"
        ? { status, releasedAt: now }
        : { status, fulfilledAt: now },
  });
  if (updated.count !== allocation.deviceAssignments.length) {
    orderError(
      "ORDER_RESERVATION_FAILED",
      409,
      "پیوند IMEI/سریال سفارش با رزرو موجودی سازگار نیست.",
    );
  }
}

async function buildCommercialLines(
  requested: readonly RequestedLine[],
  transaction: Transaction,
): Promise<
  readonly Readonly<{
    variant: OrderCatalogVariant;
    snapshot: OrderItemCommercialSnapshot;
    quantity: number;
  }>[]
> {
  if (requested.length === 0)
    orderError("ORDER_VALIDATION_FAILED", 400, "سبد خرید خالی است.");
  const variants = await orderRepository.findCatalogVariants(
    requested.map((line) => line.variantId),
    transaction,
  );
  if (variants.length !== requested.length)
    orderError(
      "ORDER_PRICE_CHANGED",
      409,
      "یکی از کالاهای سبد دیگر در دسترس نیست.",
    );
  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  return requested.map((line) => {
    const variant = byId.get(line.variantId);
    if (!variant)
      orderError(
        "ORDER_PRICE_CHANGED",
        409,
        "یکی از کالاهای سبد دیگر در دسترس نیست.",
      );
    const snapshot = itemSnapshotOf(variant);
    if (
      line.cartUnitPriceRials !== undefined &&
      line.cartUnitPriceRials !== variant.priceRials
    ) {
      orderError(
        "ORDER_PRICE_CHANGED",
        409,
        "قیمت یکی از کالاها تغییر کرده است؛ سبد را تازه‌سازی کنید.",
      );
    }
    return { variant, snapshot, quantity: line.quantity };
  });
}

async function persistNewOrder(
  input: Readonly<{
    actor: SessionActor;
    context: OrderAuditContext;
    customerId: string;
    source:
      | "STOREFRONT"
      | "ADMIN"
      | "BRANCH_POS"
      | "CALL_CENTER"
      | "IMPORT"
      | "API";
    type:
      | "STANDARD_SALE"
      | "PICKUP"
      | "DELIVERY"
      | "RESERVATION"
      | "PREORDER"
      | "INSTALLMENT_PLACEHOLDER"
      | "TRADE_IN_PLACEHOLDER";
    fulfillmentMethod: "PICKUP" | "DELIVERY";
    pickupBranchId?: string;
    billingAddressId?: string;
    shippingAddressId?: string;
    requestedLines: readonly RequestedLine[];
    sourceCart?: Readonly<{
      id: string;
      version: number;
      guestTokenHash: string | null;
    }>;
    /** Administrative commands must prove allocation ownership before any row is created. */
    enforceAllocationBranchScope?: boolean;
    idempotencyScope: string;
    idempotencyKey: string;
    idempotencyHash: string;
  }>,
  transaction: Transaction,
): Promise<OrderDetailRecord> {
  const [identity, commercialLines] = await Promise.all([
    loadCustomerAndAddresses(
      {
        customerId: input.customerId,
        ...(input.billingAddressId === undefined
          ? {}
          : { billingAddressId: input.billingAddressId }),
        ...(input.shippingAddressId === undefined
          ? {}
          : { shippingAddressId: input.shippingAddressId }),
      },
      transaction,
    ),
    buildCommercialLines(input.requestedLines, transaction),
  ]);
  if (input.fulfillmentMethod === "DELIVERY" && !identity.shippingAddress) {
    orderError(
      "ORDER_VALIDATION_FAILED",
      400,
      "برای ارسال، نشانی معتبر لازم است.",
    );
  }

  const pricing = calculateOrderPricing({
    currency: "IRR",
    lines: commercialLines.map((line) => ({
      quantity: line.quantity,
      unitPriceRials: line.variant.priceRials,
    })),
  });
  const candidates = await orderRepository.findSellableInventoryCandidates(
    commercialLines.map((line) => line.variant.id),
    input.fulfillmentMethod === "PICKUP" ? input.pickupBranchId : undefined,
    transaction,
  );
  const allocationPlan = planSingleBranchAllocation(
    commercialLines.map((line) => ({
      variantId: line.variant.id,
      quantity: line.quantity,
    })),
    candidates,
    input.fulfillmentMethod === "PICKUP" ? input.pickupBranchId : undefined,
  );
  if (
    input.fulfillmentMethod === "PICKUP" &&
    allocationPlan.branchId !== input.pickupBranchId
  ) {
    orderError(
      "ORDER_ALLOCATION_FAILED",
      409,
      "شعبهٔ انتخاب‌شده موجودی کامل سفارش را ندارد.",
    );
  }
  if (input.enforceAllocationBranchScope) {
    // This check is intentionally before `order.create` and reservation writes.
    // A branch-scoped administrative actor must never create an order in a
    // different branch and only then receive a forbidden response.
    requireOrderBranchAccess(input.actor, allocationPlan.branchId);
  }

  const orderNumber = createOrderNumber();
  const created = await transaction.order.create({
    data: {
      orderNumber,
      source: input.source,
      type: input.type,
      customerId: input.customerId,
      ...(input.sourceCart === undefined
        ? {}
        : {
            sourceCartId: input.sourceCart.id,
            guestTokenHash: input.sourceCart.guestTokenHash,
          }),
      customerSnapshot: customerSnapshotOf(identity.customer),
      ...(identity.billingAddress === null
        ? {}
        : { billingAddressSnapshot: identity.billingAddress }),
      ...(identity.shippingAddress === null
        ? {}
        : { shippingAddressSnapshot: identity.shippingAddress }),
      currency: pricing.currency,
      subtotalRials: pricing.subtotalRials,
      discountTotalRials: pricing.discountTotalRials,
      taxTotalRials: pricing.taxTotalRials,
      shippingTotalRials: pricing.shippingTotalRials,
      feeTotalRials: pricing.feeTotalRials,
      grandTotalRials: pricing.grandTotalRials,
      fulfillmentMethod: input.fulfillmentMethod,
      orderStatus: "DRAFT",
      allocationStatus: "UNALLOCATED",
      items: {
        create: commercialLines.map((line, index) => {
          const calculated = pricing.lines[index];
          if (!calculated || !line.variant.skuRecord)
            orderError(
              "ORDER_VALIDATION_FAILED",
              400,
              "کالای سفارش معتبر نیست.",
            );
          return {
            productId: line.snapshot.productId,
            variantId: line.snapshot.variantId,
            productSkuId: line.variant.skuRecord.id,
            sku: line.snapshot.sku,
            productName: line.snapshot.productName,
            variantName: line.snapshot.variantName,
            quantity: line.quantity,
            unitPriceRials: calculated.unitPriceRials,
            discountAmountRials: calculated.discountAmountRials,
            taxAmountRials: calculated.taxAmountRials,
            lineTotalRials: calculated.lineTotalRials,
            ...(line.snapshot.warranty === null
              ? {}
              : { warrantySnapshot: line.snapshot.warranty }),
            attributesSnapshot: line.snapshot
              .attributes as Prisma.InputJsonValue,
          };
        }),
      },
    },
    select: {
      id: true,
      orderNumber: true,
      version: true,
      items: { select: { id: true, variantId: true } },
    },
  });

  for (const item of created.items) {
    const plan = allocationPlan.allocations.find(
      (entry) => entry.variantId === item.variantId,
    );
    if (!plan)
      orderError(
        "ORDER_ALLOCATION_FAILED",
        409,
        "برنامهٔ تخصیص سفارش کامل نیست.",
      );
    const reservation = await reserveOrderInventory(
      {
        orderId: created.id,
        orderNumber: created.orderNumber,
        orderItemId: item.id,
        allocation: plan,
        actorId: input.actor.id,
        expiresAt: new Date(Date.now() + ORDER_RESERVATION_TTL_MS),
      },
      transaction,
    );
    const allocation = await transaction.orderAllocation.create({
      data: {
        orderId: created.id,
        orderItemId: item.id,
        branchId: reservation.branchId,
        warehouseId: reservation.warehouseId,
        inventoryItemId: reservation.inventoryItemId,
        reservationId: reservation.reservationId,
        quantity: reservation.quantity,
        status: "ALLOCATED",
      },
      select: { id: true },
    });
    await createOrderDeviceAssignments(transaction, {
      orderId: created.id,
      orderItemId: item.id,
      orderAllocationId: allocation.id,
      reservationId: reservation.reservationId,
      deviceUnits: reservation.trackedDeviceUnits,
    });
  }

  const transitioned = await transaction.order.updateMany({
    where: { id: created.id, version: created.version, orderStatus: "DRAFT" },
    data: {
      orderStatus: "PENDING_CONFIRMATION",
      allocationStatus: "ALLOCATED",
      version: { increment: 1 },
    },
  });
  if (transitioned.count !== 1)
    orderError("ORDER_VERSION_CONFLICT", 409, "سفارش هم‌زمان تغییر کرده است.");
  const version = created.version + 1;
  await transaction.orderPayment.create({
    data: {
      orderId: created.id,
      provider: "PHASE_08_PENDING",
      method: "MANUAL_REVIEW",
      amountRials: pricing.grandTotalRials,
      status: "UNPAID",
      idempotencyKey: `order-payment-placeholder:${created.id}`,
    },
  });
  await writeStatusHistory(transaction, {
    orderId: created.id,
    fromStatus: "DRAFT",
    toStatus: "PENDING_CONFIRMATION",
    actor: input.actor,
    context: input.context,
    version,
  });
  await writeAudit(transaction, {
    actor: input.actor,
    context: input.context,
    action: "order.created",
    order: {
      id: created.id,
      orderNumber: created.orderNumber,
      orderStatus: "PENDING_CONFIRMATION",
      version,
    },
    after: { allocationStatus: "ALLOCATED", itemCount: created.items.length },
  });
  await writeOutboxEvent(transaction, {
    orderId: created.id,
    eventType: "order.created",
    aggregateVersion: version,
    orderNumber: created.orderNumber,
    status: "PENDING_CONFIRMATION",
    allocationStatus: "ALLOCATED",
  });
  await writeOutboxEvent(transaction, {
    orderId: created.id,
    eventType: "order.inventory_reserved",
    aggregateVersion: version,
    orderNumber: created.orderNumber,
    status: "PENDING_CONFIRMATION",
    allocationStatus: "ALLOCATED",
  });
  if (input.sourceCart) {
    const converted = await orderRepository.markCartConverted(
      {
        cartId: input.sourceCart.id,
        version: input.sourceCart.version,
        customerId: input.customerId,
      },
      transaction,
    );
    if (converted.count !== 1)
      orderError(
        "ORDER_VERSION_CONFLICT",
        409,
        "سبد خرید هم‌زمان تغییر کرده است؛ دوباره تلاش کنید.",
      );
  }
  await orderRepository.createIdempotencyRecord(
    {
      scope: input.idempotencyScope,
      key: input.idempotencyKey,
      requestHash: input.idempotencyHash,
      responseReference: created.orderNumber,
      orderId: created.id,
      expiresAt: new Date(Date.now() + ORDER_IDEMPOTENCY_RETENTION_MS),
    },
    transaction,
  );
  return ensureOrderRecord(
    await orderRepository.findOrderById(created.id, transaction),
  );
}

export async function createStorefrontOrder(
  actor: SessionActor,
  guestTokenHash: string,
  input: CreateOrderFromCartInput,
  context: OrderAuditContext,
): Promise<OrderDetailDto> {
  requirePermission(actor, "orders.create");
  const scope = `order:create:storefront:${actor.id}`;
  const hash = requestHash({ actorId: actor.id, guestTokenHash, input });
  const record = await executeIdempotentOrderCommand({
    operation: "create",
    scope,
    key: input.idempotencyKey,
    hash,
    onCommitted: () => recordOrderLifecycleEvent("created"),
    execute: async (transaction) => {
      const cart = await orderRepository.findCheckoutCartByGuestTokenHash(
        guestTokenHash,
        transaction,
      );
      if (
        !cart ||
        cart.items.length === 0 ||
        (cart.userId && cart.userId !== actor.id)
      ) {
        orderError(
          "ORDER_VALIDATION_FAILED",
          400,
          "سبد خرید فعال برای ثبت سفارش یافت نشد.",
        );
      }
      return persistNewOrder(
        {
          actor,
          context,
          customerId: actor.id,
          source: "STOREFRONT",
          type: input.fulfillmentMethod === "PICKUP" ? "PICKUP" : "DELIVERY",
          fulfillmentMethod: input.fulfillmentMethod,
          ...(input.pickupBranchId === undefined
            ? {}
            : { pickupBranchId: input.pickupBranchId }),
          ...(input.billingAddressId === undefined
            ? {}
            : { billingAddressId: input.billingAddressId }),
          ...(input.shippingAddressId === undefined
            ? {}
            : { shippingAddressId: input.shippingAddressId }),
          requestedLines: cart.items.map((item) => ({
            variantId: item.variant.id,
            quantity: item.quantity,
            cartUnitPriceRials: item.unitPriceRials,
          })),
          sourceCart: {
            id: cart.id,
            version: cart.version,
            guestTokenHash: cart.guestTokenHash,
          },
          idempotencyScope: scope,
          idempotencyKey: input.idempotencyKey,
          idempotencyHash: hash,
        },
        transaction,
      );
    },
  });
  return mapOrderDetail(record, false, true, true);
}

export async function createAdminOrder(
  actor: SessionActor,
  input: CreateAdminOrderInput,
  context: OrderAuditContext,
): Promise<OrderDetailDto> {
  requirePermission(actor, "orders.create_admin");
  if (input.fulfillmentMethod === "PICKUP" && input.pickupBranchId)
    requireOrderBranchAccess(actor, input.pickupBranchId);
  const scope = `order:create:admin:${actor.id}`;
  const hash = requestHash({ actorId: actor.id, input });
  const record = await executeIdempotentOrderCommand({
    operation: "create",
    scope,
    key: input.idempotencyKey,
    hash,
    onCommitted: () => recordOrderLifecycleEvent("created"),
    execute: (transaction) =>
      persistNewOrder(
        {
          actor,
          context,
          customerId: input.customerId,
          source: input.source,
          type: input.type,
          fulfillmentMethod: input.fulfillmentMethod,
          ...(input.pickupBranchId === undefined
            ? {}
            : { pickupBranchId: input.pickupBranchId }),
          ...(input.billingAddressId === undefined
            ? {}
            : { billingAddressId: input.billingAddressId }),
          ...(input.shippingAddressId === undefined
            ? {}
            : { shippingAddressId: input.shippingAddressId }),
          requestedLines: input.items,
          enforceAllocationBranchScope: true,
          idempotencyScope: scope,
          idempotencyKey: input.idempotencyKey,
          idempotencyHash: hash,
        },
        transaction,
      ),
  });
  await assertOrderBranchScope(actor, record);
  return mapOrderDetail(
    record,
    hasPermission(actor, "orders.audit.read") ||
      hasPermission(actor, "orders.add_internal_note"),
    hasPermission(actor, "orders.view_financials"),
    hasPermission(actor, "orders.view_customer_pii"),
    hasPermission(actor, "orders.view_imei"),
  );
}

export async function getCustomerOrder(
  actor: SessionActor,
  orderNumber: string,
): Promise<OrderDetailDto> {
  requirePermission(actor, "orders.read_own");
  const record = await orderRepository.findOrderForCustomerByNumber(
    orderNumber,
    actor.id,
  );
  if (!record)
    orderError("ORDER_ACCESS_DENIED", 403, "Order access is denied.");
  if (record.customerId !== actor.id) {
    orderError(
      "ORDER_ACCESS_DENIED",
      403,
      "اجازهٔ مشاهدهٔ این سفارش را ندارید.",
    );
  }
  return mapOrderDetail(record, false, true, true);
}

export async function listCustomerOrders(
  actor: SessionActor,
  query: OrderListQuery,
): Promise<Page<OrderListItemDto>> {
  requirePermission(actor, "orders.read_own");
  const result = await orderRepository.findOrderPage({
    ...query,
    customerId: actor.id,
  });
  return toPage(
    result.items.map((record) => mapOrderList(record, true, true)),
    query,
    result.total,
  );
}

export async function listAdminOrders(
  actor: SessionActor,
  query: OrderListQuery,
  context?: OrderAuditContext,
): Promise<Page<OrderListItemDto>> {
  requirePermission(actor, "orders.read");
  const scope = resolveOrderBranchScope(actor);
  if (
    scope !== undefined &&
    query.branchId !== undefined &&
    query.branchId !== scope
  )
    throw new AuthorizationError();
  const result = await orderRepository.findOrderPage({
    ...query,
    ...(scope === undefined ? {} : { branchId: scope }),
  });
  const includePii =
    hasPermission(actor, "orders.view_customer_pii") && context !== undefined;
  if (includePii) {
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorType: actorType(actor),
        action: "order.customer_pii.list_viewed",
        entityType: "Order",
        requestId: context.requestId,
        reasonCode: "CUSTOMER_PII_LIST_VIEW",
        ...(context.ipAddress === undefined
          ? {}
          : { ipAddress: context.ipAddress }),
        ...(context.userAgent === undefined
          ? {}
          : { userAgent: context.userAgent }),
        // Deliberately exclude the free-text search term because it may itself
        // contain an email address or mobile number.
        metadata: {
          page: query.page,
          pageSize: query.pageSize,
          resultCount: result.items.length,
        },
      },
    });
  }
  return toPage(
    result.items.map((record) =>
      mapOrderList(
        record,
        includePii,
        hasPermission(actor, "orders.view_financials"),
      ),
    ),
    query,
    result.total,
  );
}

export async function getAdminOrder(
  actor: SessionActor,
  id: string,
  context?: OrderAuditContext,
): Promise<OrderDetailDto> {
  requirePermission(actor, "orders.read");
  const record = ensureOrderRecord(await orderRepository.findOrderById(id));
  await assertOrderBranchScope(actor, record);
  const includePii =
    hasPermission(actor, "orders.view_customer_pii") && context !== undefined;
  if (includePii) {
    // The caller must supply a correlated audit context before a PII-capable
    // projection leaves the service. Reads fail closed if that evidence cannot
    // be recorded, rather than returning customer data without an audit trail.
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorType: actorType(actor),
        action: "order.customer_pii.viewed",
        entityType: "Order",
        entityId: record.id,
        requestId: context.requestId,
        reasonCode: "CUSTOMER_PII_VIEW",
        ...(context.ipAddress === undefined
          ? {}
          : { ipAddress: context.ipAddress }),
        ...(context.userAgent === undefined
          ? {}
          : { userAgent: context.userAgent }),
        metadata: {
          orderNumber: record.orderNumber,
          projection: "admin_detail",
        },
      },
    });
  }
  return mapOrderDetail(
    record,
    hasPermission(actor, "orders.audit.read") ||
      hasPermission(actor, "orders.add_internal_note"),
    hasPermission(actor, "orders.view_financials"),
    includePii,
    hasPermission(actor, "orders.view_imei"),
  );
}

async function createCommandIdempotencyRecord(
  transaction: Transaction,
  input: Readonly<{
    scope: string;
    key: string;
    hash: string;
    order: OrderDetailRecord;
  }>,
): Promise<void> {
  await orderRepository.createIdempotencyRecord(
    {
      scope: input.scope,
      key: input.key,
      requestHash: input.hash,
      responseReference: input.order.orderNumber,
      orderId: input.order.id,
      expiresAt: new Date(Date.now() + ORDER_IDEMPOTENCY_RETENTION_MS),
    },
    transaction,
  );
}

function requiresPaidCancellation(status: string): boolean {
  return (
    status === "PAID" ||
    status === "PARTIALLY_PAID" ||
    status === "PARTIALLY_REFUNDED" ||
    status === "REFUNDED"
  );
}

export async function confirmOrder(
  actor: SessionActor,
  id: string,
  input: ConfirmOrderInput,
  context: OrderAuditContext,
): Promise<OrderDetailDto> {
  requirePermission(actor, "orders.confirm");
  const scope = `order:${id}:confirm:${actor.id}`;
  const hash = requestHash({ actorId: actor.id, id, input });
  const record = await executeIdempotentOrderCommand({
    operation: "confirm",
    scope,
    key: input.idempotencyKey,
    hash,
    onCommitted: () => recordOrderLifecycleEvent("confirmed"),
    execute: async (transaction) => {
      const current = ensureOrderRecord(
        await orderRepository.findOrderById(id, transaction),
      );
      await assertOrderBranchScope(actor, current);
      if (current.version !== input.expectedVersion) {
        orderError(
          "ORDER_VERSION_CONFLICT",
          409,
          "نسخهٔ سفارش تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.",
        );
      }
      const now = new Date();
      const reservationsActive =
        current.allocations.length > 0 &&
        current.allocations.every(
          (allocation) =>
            allocation.status === "ALLOCATED" &&
            allocation.reservation?.status === "ACTIVE" &&
            (allocation.reservation.expiresAt === null ||
              allocation.reservation.expiresAt > now),
        );
      await assertOrderStatusTransitionWithRejectionAudit({
        actor,
        context,
        order: current,
        transition: {
          fromStatus: current.orderStatus,
          toStatus: "CONFIRMED",
          context: {
            reservationActive: reservationsActive,
            allocationStatus: current.allocationStatus,
            // Phase 07 has no gateway settlement. Confirmation records an
            // explicit manual-review obligation; final completion still demands
            // a PAID payment status.
            paymentPolicyAllowsConfirmation: [
              "UNPAID",
              "PENDING",
              "AUTHORIZED",
              "PAID",
            ].includes(current.paymentStatus),
          },
        },
      });
      const result = await transaction.order.updateMany({
        where: {
          id: current.id,
          version: input.expectedVersion,
          orderStatus: "PENDING_CONFIRMATION",
        },
        data: { orderStatus: "CONFIRMED", version: { increment: 1 } },
      });
      if (result.count !== 1)
        orderError(
          "ORDER_VERSION_CONFLICT",
          409,
          "سفارش هم‌زمان تغییر کرده است.",
        );
      const version = input.expectedVersion + 1;
      const activeReservationIds = current.allocations
        .filter((allocation) => allocation.reservationId !== null)
        .map((allocation) => allocation.reservationId as string);
      const extended = await transaction.inventoryReservation.updateMany({
        where: { id: { in: activeReservationIds }, status: "ACTIVE" },
        data: {
          expiresAt: new Date(
            now.getTime() + ORDER_CONFIRMED_RESERVATION_TTL_MS,
          ),
        },
      });
      if (extended.count !== activeReservationIds.length) {
        orderError(
          "ORDER_RESERVATION_FAILED",
          409,
          "تمدید رزروهای فعال سفارش ناموفق بود.",
        );
      }
      await writeStatusHistory(transaction, {
        orderId: current.id,
        fromStatus: "PENDING_CONFIRMATION",
        toStatus: "CONFIRMED",
        actor,
        context,
        version,
      });
      await writeAudit(transaction, {
        actor,
        context,
        action: "order.confirmed",
        order: {
          id: current.id,
          orderNumber: current.orderNumber,
          orderStatus: "CONFIRMED",
          version,
        },
        before: { status: current.orderStatus },
        after: { status: "CONFIRMED" },
      });
      await writeOutboxEvent(transaction, {
        orderId: current.id,
        eventType: "order.confirmed",
        aggregateVersion: version,
        orderNumber: current.orderNumber,
        status: "CONFIRMED",
        allocationStatus: current.allocationStatus,
      });
      const updated = ensureOrderRecord(
        await orderRepository.findOrderById(current.id, transaction),
      );
      await createCommandIdempotencyRecord(transaction, {
        scope,
        key: input.idempotencyKey,
        hash,
        order: updated,
      });
      return updated;
    },
  });
  return mapOrderDetail(
    record,
    hasPermission(actor, "orders.audit.read") ||
      hasPermission(actor, "orders.add_internal_note"),
    hasPermission(actor, "orders.view_financials"),
    hasPermission(actor, "orders.view_customer_pii"),
    hasPermission(actor, "orders.view_imei"),
  );
}

/**
 * Rebuild a released or failed allocation from immutable order lines. New
 * sales reserve inventory on creation, but this command is intentionally
 * available for the operational recovery path after a reservation expires.
 * It never accepts a client price, quantity, SKU, or inventory-item id.
 */
export async function allocateOrder(
  actor: SessionActor,
  id: string,
  input: AllocateOrderInput,
  context: OrderAuditContext,
): Promise<OrderDetailDto> {
  requirePermission(actor, "orders.allocate");
  const scope = `order:${id}:allocate:${actor.id}`;
  const hash = requestHash({ actorId: actor.id, id, input });
  const record = await executeIdempotentOrderCommand({
    operation: "allocate",
    scope,
    key: input.idempotencyKey,
    hash,
    execute: async (transaction) => {
      const current = ensureOrderRecord(
        await orderRepository.findOrderById(id, transaction),
      );
      if (current.version !== input.expectedVersion) {
        orderError(
          "ORDER_VERSION_CONFLICT",
          409,
          "نسخهٔ سفارش تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.",
        );
      }
      if (current.orderStatus !== "PENDING_CONFIRMATION") {
        orderError(
          "ORDER_ALLOCATION_FAILED",
          409,
          "فقط سفارش در انتظار تأیید را می‌توان دوباره تخصیص داد.",
        );
      }

      const actorScope = resolveOrderBranchScope(actor);
      const preferredBranchId = input.branchId ?? actorScope;
      if (input.branchId !== undefined)
        requireOrderBranchAccess(actor, input.branchId);
      if (current.allocations.length > 0)
        await assertOrderBranchScope(actor, current);

      const now = new Date();
      const activeAllocations = current.allocations.filter(
        (allocation) =>
          allocation.status === "ALLOCATED" &&
          allocation.reservation?.status === "ACTIVE" &&
          (allocation.reservation.expiresAt === null ||
            allocation.reservation.expiresAt > now),
      );
      if (
        activeAllocations.length === current.items.length &&
        current.allocationStatus === "ALLOCATED"
      ) {
        if (
          preferredBranchId !== undefined &&
          activeAllocations.some(
            (allocation) => allocation.branchId !== preferredBranchId,
          )
        ) {
          orderError(
            "ORDER_ALLOCATION_FAILED",
            409,
            "تخصیص فعال سفارش با شعبهٔ انتخاب‌شده سازگار نیست.",
          );
        }
        await createCommandIdempotencyRecord(transaction, {
          scope,
          key: input.idempotencyKey,
          hash,
          order: current,
        });
        return current;
      }
      if (activeAllocations.length > 0) {
        orderError(
          "ORDER_ALLOCATION_FAILED",
          409,
          "بازسازی تخصیص جزئی به‌صورت خودکار مجاز نیست.",
        );
      }

      for (const allocation of current.allocations) {
        if (
          allocation.status !== "ALLOCATED" ||
          allocation.reservation?.status !== "ACTIVE" ||
          !allocation.reservationId
        )
          continue;
        await releaseOrderInventory(
          {
            orderId: current.id,
            orderNumber: current.orderNumber,
            orderItemId: allocation.orderItemId,
            reservationId: allocation.reservationId,
            inventoryItemId: allocation.inventoryItemId,
            quantity: allocation.quantity,
            actorId: actor.id,
            releaseStatus: "EXPIRED",
          },
          transaction,
        );
        await transitionOrderDeviceAssignments(
          transaction,
          allocation,
          "RELEASED",
          now,
        );
        await transaction.orderAllocation.updateMany({
          where: { id: allocation.id, status: "ALLOCATED" },
          data: { status: "RELEASED" },
        });
      }

      const candidates = await orderRepository.findSellableInventoryCandidates(
        current.items.map((item) => item.variantId),
        preferredBranchId,
        transaction,
      );
      const plan = planSingleBranchAllocation(
        current.items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        candidates,
        preferredBranchId,
      );
      requireOrderBranchAccess(actor, plan.branchId);

      for (const item of current.items) {
        const itemPlan = plan.allocations.find(
          (entry) => entry.variantId === item.variantId,
        );
        if (!itemPlan)
          orderError(
            "ORDER_ALLOCATION_FAILED",
            409,
            "برنامهٔ تخصیص تمام اقلام سفارش را پوشش نمی‌دهد.",
          );
        const reservation = await reserveOrderInventory(
          {
            orderId: current.id,
            orderNumber: current.orderNumber,
            orderItemId: item.id,
            allocation: itemPlan,
            actorId: actor.id,
            expiresAt: new Date(Date.now() + ORDER_RESERVATION_TTL_MS),
          },
          transaction,
        );
        const allocation = await transaction.orderAllocation.create({
          data: {
            orderId: current.id,
            orderItemId: item.id,
            branchId: reservation.branchId,
            warehouseId: reservation.warehouseId,
            inventoryItemId: reservation.inventoryItemId,
            reservationId: reservation.reservationId,
            quantity: reservation.quantity,
            status: "ALLOCATED",
          },
          select: { id: true },
        });
        await createOrderDeviceAssignments(transaction, {
          orderId: current.id,
          orderItemId: item.id,
          orderAllocationId: allocation.id,
          reservationId: reservation.reservationId,
          deviceUnits: reservation.trackedDeviceUnits,
        });
      }

      const updatedOrder = await transaction.order.updateMany({
        where: {
          id: current.id,
          version: input.expectedVersion,
          orderStatus: "PENDING_CONFIRMATION",
        },
        data: { allocationStatus: "ALLOCATED", version: { increment: 1 } },
      });
      if (updatedOrder.count !== 1)
        orderError(
          "ORDER_VERSION_CONFLICT",
          409,
          "سفارش هم‌زمان تغییر کرده است.",
        );
      const version = input.expectedVersion + 1;
      await writeAudit(transaction, {
        actor,
        context,
        action: "order.allocated",
        order: {
          id: current.id,
          orderNumber: current.orderNumber,
          orderStatus: current.orderStatus,
          version,
        },
        before: { allocationStatus: current.allocationStatus },
        after: {
          allocationStatus: "ALLOCATED",
          branchId: plan.branchId,
          warehouseId: plan.warehouseId,
        },
      });
      await writeOutboxEvent(transaction, {
        orderId: current.id,
        eventType: "order.allocated",
        aggregateVersion: version,
        orderNumber: current.orderNumber,
        status: current.orderStatus,
        allocationStatus: "ALLOCATED",
      });
      const updated = ensureOrderRecord(
        await orderRepository.findOrderById(current.id, transaction),
      );
      await createCommandIdempotencyRecord(transaction, {
        scope,
        key: input.idempotencyKey,
        hash,
        order: updated,
      });
      return updated;
    },
  });
  return mapOrderDetail(
    record,
    hasPermission(actor, "orders.audit.read") ||
      hasPermission(actor, "orders.add_internal_note"),
    hasPermission(actor, "orders.view_financials"),
    hasPermission(actor, "orders.view_customer_pii"),
    hasPermission(actor, "orders.view_imei"),
  );
}

export async function cancelOrder(
  actor: SessionActor,
  id: string,
  input: CancelOrderInput,
  context: OrderAuditContext,
): Promise<OrderDetailDto> {
  const scope = `order:${id}:cancel:${actor.id}`;
  const hash = requestHash({ actorId: actor.id, id, input });
  const record = await executeIdempotentOrderCommand({
    operation: "cancel",
    scope,
    key: input.idempotencyKey,
    hash,
    onCommitted: () => recordOrderLifecycleEvent("cancelled"),
    execute: async (transaction) => {
      const current = ensureOrderRecord(
        await orderRepository.findOrderById(id, transaction),
      );
      const customerOwnedCancellation =
        !actor.isAdmin && current.customerId === actor.id;
      if (customerOwnedCancellation) {
        // Keep the ownership permission inside the service boundary. Routes
        // already resolve the owned order for a friendly response, but callers
        // of this service must not be able to bypass that authorization step.
        requirePermission(actor, "orders.read_own");
        if (
          current.orderStatus !== "PENDING_CONFIRMATION" ||
          requiresPaidCancellation(current.paymentStatus)
        ) {
          orderError(
            "ORDER_CANCELLATION_NOT_ALLOWED",
            409,
            "لغو این سفارش در وضعیت فعلی مجاز نیست.",
          );
        }
      } else {
        if (requiresPaidCancellation(current.paymentStatus))
          requirePermission(actor, "orders.cancel_after_payment");
        else requirePermission(actor, "orders.cancel");
        await assertOrderBranchScope(actor, current);
      }
      if (current.version !== input.expectedVersion) {
        orderError(
          "ORDER_VERSION_CONFLICT",
          409,
          "نسخهٔ سفارش تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.",
        );
      }
      await assertOrderStatusTransitionWithRejectionAudit({
        actor,
        context,
        order: current,
        transition: {
          fromStatus: current.orderStatus,
          toStatus: "CANCELLED",
          reasonCode: input.reasonCode,
          context: {
            cancellationAllowed: true,
            paymentStatus: current.paymentStatus,
            fulfillmentStatus: current.fulfillmentStatus,
          },
        },
      });
      for (const allocation of current.allocations) {
        if (allocation.status !== "ALLOCATED" || !allocation.reservationId)
          continue;
        await releaseOrderInventory(
          {
            orderId: current.id,
            orderNumber: current.orderNumber,
            orderItemId: allocation.orderItemId,
            reservationId: allocation.reservationId,
            inventoryItemId: allocation.inventoryItemId,
            quantity: allocation.quantity,
            actorId: actor.id,
          },
          transaction,
        );
        await transitionOrderDeviceAssignments(
          transaction,
          allocation,
          "RELEASED",
        );
      }
      await transaction.orderAllocation.updateMany({
        where: {
          orderId: current.id,
          status: {
            in: [
              "UNALLOCATED",
              "PARTIALLY_ALLOCATED",
              "ALLOCATED",
              "ALLOCATION_FAILED",
            ],
          },
        },
        data: { status: "RELEASED" },
      });
      if (!requiresPaidCancellation(current.paymentStatus)) {
        await transaction.orderPayment.updateMany({
          where: {
            orderId: current.id,
            status: { in: ["UNPAID", "PENDING", "AUTHORIZED"] },
          },
          data: { status: "CANCELLED" },
        });
      }
      if (current.fulfillment) {
        await transaction.orderFulfillment.update({
          where: { orderId: current.id },
          data: { status: "CANCELLED" },
        });
      }
      const result = await transaction.order.updateMany({
        where: { id: current.id, version: input.expectedVersion },
        data: {
          orderStatus: "CANCELLED",
          allocationStatus: "RELEASED",
          ...(requiresPaidCancellation(current.paymentStatus)
            ? {}
            : { paymentStatus: "CANCELLED" }),
          ...(current.fulfillment ? { fulfillmentStatus: "CANCELLED" } : {}),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1)
        orderError(
          "ORDER_VERSION_CONFLICT",
          409,
          "سفارش هم‌زمان تغییر کرده است.",
        );
      const version = input.expectedVersion + 1;
      await writeStatusHistory(transaction, {
        orderId: current.id,
        fromStatus: current.orderStatus,
        toStatus: "CANCELLED",
        actor,
        context,
        version,
        reasonCode: input.reasonCode,
        ...(input.note === undefined || input.note === null
          ? {}
          : { note: input.note }),
      });
      await writeAudit(transaction, {
        actor,
        context,
        action: "order.cancelled",
        order: {
          id: current.id,
          orderNumber: current.orderNumber,
          orderStatus: "CANCELLED",
          version,
        },
        reasonCode: input.reasonCode,
        before: {
          status: current.orderStatus,
          allocationStatus: current.allocationStatus,
        },
        after: { status: "CANCELLED", allocationStatus: "RELEASED" },
      });
      await writeOutboxEvent(transaction, {
        orderId: current.id,
        eventType: "order.cancelled",
        aggregateVersion: version,
        orderNumber: current.orderNumber,
        status: "CANCELLED",
        allocationStatus: "RELEASED",
      });
      if (requiresPaidCancellation(current.paymentStatus)) {
        await writeOutboxEvent(transaction, {
          orderId: current.id,
          eventType: "order.refund_required",
          aggregateVersion: version,
          orderNumber: current.orderNumber,
          status: "CANCELLED",
          allocationStatus: "RELEASED",
        });
      }
      const updated = ensureOrderRecord(
        await orderRepository.findOrderById(current.id, transaction),
      );
      await createCommandIdempotencyRecord(transaction, {
        scope,
        key: input.idempotencyKey,
        hash,
        order: updated,
      });
      return updated;
    },
  });
  return mapOrderDetail(
    record,
    actor.isAdmin &&
      (hasPermission(actor, "orders.audit.read") ||
        hasPermission(actor, "orders.add_internal_note")),
    actor.isAdmin ? hasPermission(actor, "orders.view_financials") : true,
    actor.isAdmin ? hasPermission(actor, "orders.view_customer_pii") : true,
    actor.isAdmin && hasPermission(actor, "orders.view_imei"),
  );
}

const FULFILLMENT_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  PENDING: ["PICKING", "PACKED", "READY_FOR_PICKUP", "SHIPPED"],
  PICKING: ["PACKED", "READY_FOR_PICKUP", "SHIPPED"],
  PACKED: ["READY_FOR_PICKUP", "SHIPPED"],
  READY_FOR_PICKUP: ["DELIVERED"],
  SHIPPED: ["DELIVERED"],
};

function assertFulfillmentTransition(
  fromStatus: string | null,
  toStatus: string,
): void {
  if (fromStatus === null) {
    if (toStatus === "DELIVERED") {
      orderError(
        "ORDER_INVALID_TRANSITION",
        409,
        "تحویل نهایی باید پس از ثبت و آماده‌سازی فرآیند تحویل انجام شود.",
      );
    }
    return;
  }
  if (!FULFILLMENT_TRANSITIONS[fromStatus]?.includes(toStatus)) {
    orderError(
      "ORDER_INVALID_TRANSITION",
      409,
      "تغییر وضعیت تحویل در چرخهٔ عملیاتی مجاز نیست.",
    );
  }
}

function fulfillmentEventType(status: string, created: boolean): string {
  if (status === "READY_FOR_PICKUP") return "order.ready_for_pickup";
  if (status === "SHIPPED") return "order.shipped";
  if (status === "DELIVERED") return "order.delivered";
  return created ? "order.fulfillment_created" : "order.fulfillment_updated";
}

/**
 * Creates or advances the one fulfillment aggregate for an order. The
 * operational state is monotonic, inventory is consumed exactly once on
 * delivery, and a paid delivered order reaches COMPLETED in the same
 * serializable transaction.
 */
export async function createOrderFulfillment(
  actor: SessionActor,
  id: string,
  input: CreateOrderFulfillmentInput,
  context: OrderAuditContext,
): Promise<OrderDetailDto> {
  requirePermission(actor, "orders.fulfill");
  const scope = `order:${id}:fulfillment:${actor.id}`;
  const hash = requestHash({ actorId: actor.id, id, input });
  const record = await executeIdempotentOrderCommand({
    operation: "fulfillment",
    scope,
    key: input.idempotencyKey,
    hash,
    onCommitted: (committedOrder) => {
      if (committedOrder.orderStatus === "COMPLETED")
        recordOrderLifecycleEvent("completed");
    },
    execute: async (transaction) => {
      const current = ensureOrderRecord(
        await orderRepository.findOrderById(id, transaction),
      );
      await assertOrderBranchScope(actor, current);
      if (current.version !== input.expectedVersion) {
        orderError(
          "ORDER_VERSION_CONFLICT",
          409,
          "نسخهٔ سفارش تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.",
        );
      }
      if (current.fulfillmentMethod !== input.method) {
        orderError(
          "ORDER_VALIDATION_FAILED",
          400,
          "روش تحویل با snapshot سفارش یکسان نیست.",
        );
      }
      const primaryAllocation = current.allocations.find(
        (allocation) => allocation.status === "ALLOCATED",
      );
      if (!primaryAllocation)
        orderError(
          "ORDER_ALLOCATION_FAILED",
          409,
          "سفارش تخصیص قابل‌تحویل ندارد.",
        );
      if (
        current.orderStatus !== "CONFIRMED" &&
        current.orderStatus !== "PROCESSING"
      ) {
        orderError(
          "ORDER_INVALID_TRANSITION",
          409,
          "این سفارش در وضعیت آماده‌سازی برای تحویل نیست.",
        );
      }

      const existing = current.fulfillment;
      if (existing && existing.method !== input.method) {
        orderError(
          "ORDER_VALIDATION_FAILED",
          400,
          "روش تحویل قبلی سفارش قابل تغییر نیست.",
        );
      }
      if (
        input.branchId !== undefined &&
        input.branchId !== (existing?.branchId ?? primaryAllocation.branchId)
      ) {
        orderError(
          "ORDER_ACCESS_DENIED",
          403,
          "فرآیند تحویل باید در شعبهٔ تخصیص‌یافته انجام شود.",
        );
      }
      if (
        input.warehouseId !== undefined &&
        input.warehouseId !==
          (existing?.warehouseId ?? primaryAllocation.warehouseId)
      ) {
        orderError(
          "ORDER_ACCESS_DENIED",
          403,
          "فرآیند تحویل باید در انبار تخصیص‌یافته انجام شود.",
        );
      }
      try {
        assertFulfillmentTransition(existing?.status ?? null, input.status);
      } catch (error) {
        await recordRejectedOrderTransitionAudit({
          actor,
          context,
          order: current,
          fromStatus: existing?.status ?? null,
          requestedStatus: input.status,
          error,
        });
        throw error;
      }

      const now = new Date();
      const prepared =
        input.status === "PACKED" ||
        input.status === "READY_FOR_PICKUP" ||
        input.status === "SHIPPED" ||
        input.status === "DELIVERED";
      const shipped =
        input.status === "SHIPPED" || input.status === "DELIVERED";
      if (existing) {
        await transaction.orderFulfillment.update({
          where: { orderId: current.id },
          data: {
            status: input.status,
            ...(input.trackingCode === undefined
              ? {}
              : { trackingCode: input.trackingCode }),
            ...(existing.preparedAt || !prepared ? {} : { preparedAt: now }),
            ...(existing.shippedAt || !shipped ? {} : { shippedAt: now }),
            ...(existing.deliveredAt || input.status !== "DELIVERED"
              ? {}
              : { deliveredAt: now }),
          },
        });
      } else {
        await transaction.orderFulfillment.create({
          data: {
            orderId: current.id,
            method: input.method,
            branchId: primaryAllocation.branchId,
            warehouseId: primaryAllocation.warehouseId,
            status: input.status,
            ...(input.trackingCode === undefined
              ? {}
              : { trackingCode: input.trackingCode }),
            ...(prepared ? { preparedAt: now } : {}),
            ...(shipped ? { shippedAt: now } : {}),
          },
        });
      }

      if (input.status === "DELIVERED") {
        const activeAllocations = current.allocations.filter(
          (allocation) =>
            allocation.status === "ALLOCATED" &&
            allocation.reservation?.status === "ACTIVE" &&
            allocation.reservationId !== null,
        );
        if (activeAllocations.length !== current.items.length) {
          orderError(
            "ORDER_RESERVATION_FAILED",
            409,
            "برای تحویل نهایی، همهٔ رزروهای فعال سفارش لازم هستند.",
          );
        }
        for (const allocation of activeAllocations) {
          await consumeOrderInventory(
            {
              orderId: current.id,
              orderNumber: current.orderNumber,
              orderItemId: allocation.orderItemId,
              reservationId: allocation.reservationId as string,
              inventoryItemId: allocation.inventoryItemId,
              quantity: allocation.quantity,
              actorId: actor.id,
            },
            transaction,
          );
          await transitionOrderDeviceAssignments(
            transaction,
            allocation,
            "FULFILLED",
            now,
          );
        }
      }

      let version = input.expectedVersion;
      let operationalStatus: "CONFIRMED" | "PROCESSING" | "COMPLETED" =
        current.orderStatus;
      if (current.orderStatus === "CONFIRMED") {
        await assertOrderStatusTransitionWithRejectionAudit({
          actor,
          context,
          order: current,
          transition: {
            fromStatus: "CONFIRMED",
            toStatus: "PROCESSING",
            context: {
              allocationValid: current.allocations.every(
                (allocation) =>
                  allocation.status === "ALLOCATED" &&
                  allocation.reservation?.status === "ACTIVE",
              ),
            },
          },
        });
        const processing = await transaction.order.updateMany({
          where: { id: current.id, version, orderStatus: "CONFIRMED" },
          data: {
            orderStatus: "PROCESSING",
            fulfillmentStatus: input.status,
            version: { increment: 1 },
          },
        });
        if (processing.count !== 1)
          orderError(
            "ORDER_VERSION_CONFLICT",
            409,
            "سفارش هم‌زمان تغییر کرده است.",
          );
        version += 1;
        operationalStatus = "PROCESSING";
        await writeStatusHistory(transaction, {
          orderId: current.id,
          fromStatus: "CONFIRMED",
          toStatus: "PROCESSING",
          actor,
          context,
          version,
        });
      } else {
        const processing = await transaction.order.updateMany({
          where: { id: current.id, version, orderStatus: "PROCESSING" },
          data: { fulfillmentStatus: input.status, version: { increment: 1 } },
        });
        if (processing.count !== 1)
          orderError(
            "ORDER_VERSION_CONFLICT",
            409,
            "سفارش هم‌زمان تغییر کرده است.",
          );
        version += 1;
      }

      const completesOrder =
        input.status === "DELIVERED" && current.paymentStatus === "PAID";
      if (completesOrder) {
        await assertOrderStatusTransitionWithRejectionAudit({
          actor,
          context,
          order: current,
          transition: {
            fromStatus: "PROCESSING",
            toStatus: "COMPLETED",
            context: {
              fulfillmentStatus: "DELIVERED",
              paymentStatus: "PAID",
              fulfillmentMethod: current.fulfillmentMethod,
              pickupCollected: current.fulfillmentMethod === "PICKUP",
            },
          },
        });
        const completed = await transaction.order.updateMany({
          where: { id: current.id, version, orderStatus: "PROCESSING" },
          data: { orderStatus: "COMPLETED", version: { increment: 1 } },
        });
        if (completed.count !== 1)
          orderError(
            "ORDER_VERSION_CONFLICT",
            409,
            "سفارش هم‌زمان تغییر کرده است.",
          );
        version += 1;
        operationalStatus = "COMPLETED";
        await writeStatusHistory(transaction, {
          orderId: current.id,
          fromStatus: "PROCESSING",
          toStatus: "COMPLETED",
          actor,
          context,
          version,
        });
      }

      await writeAudit(transaction, {
        actor,
        context,
        action: existing
          ? "order.fulfillment.updated"
          : "order.fulfillment.created",
        order: {
          id: current.id,
          orderNumber: current.orderNumber,
          orderStatus: operationalStatus,
          version,
        },
        after: {
          fulfillmentStatus: input.status,
          ...(completesOrder ? { orderStatus: "COMPLETED" } : {}),
        },
      });
      await writeOutboxEvent(transaction, {
        orderId: current.id,
        eventType: fulfillmentEventType(input.status, existing === null),
        aggregateVersion: version,
        orderNumber: current.orderNumber,
        status: operationalStatus,
        allocationStatus: current.allocationStatus,
      });
      if (completesOrder) {
        await writeOutboxEvent(transaction, {
          orderId: current.id,
          eventType: "order.completed",
          aggregateVersion: version,
          orderNumber: current.orderNumber,
          status: "COMPLETED",
          allocationStatus: current.allocationStatus,
        });
      }
      const updated = ensureOrderRecord(
        await orderRepository.findOrderById(current.id, transaction),
      );
      await createCommandIdempotencyRecord(transaction, {
        scope,
        key: input.idempotencyKey,
        hash,
        order: updated,
      });
      return updated;
    },
  });
  return mapOrderDetail(
    record,
    hasPermission(actor, "orders.audit.read") ||
      hasPermission(actor, "orders.add_internal_note"),
    hasPermission(actor, "orders.view_financials"),
    hasPermission(actor, "orders.view_customer_pii"),
    hasPermission(actor, "orders.view_imei"),
  );
}

export async function recordOrderPayment(
  actor: SessionActor,
  id: string,
  input: RecordOrderPaymentInput,
  context: OrderAuditContext,
): Promise<OrderDetailDto> {
  requirePermission(actor, "orders.view_financials");
  const scope = `order:${id}:payment:${actor.id}`;
  const hash = requestHash({ actorId: actor.id, id, input });
  const record = await executeIdempotentOrderCommand({
    operation: "payment",
    scope,
    key: input.idempotencyKey,
    hash,
    onCommitted: (committedOrder) => {
      if (committedOrder.orderStatus === "COMPLETED")
        recordOrderLifecycleEvent("completed");
    },
    execute: async (transaction) => {
      const current = ensureOrderRecord(
        await orderRepository.findOrderById(id, transaction),
      );
      await assertOrderBranchScope(actor, current);
      if (current.version !== input.expectedVersion)
        orderError(
          "ORDER_VERSION_CONFLICT",
          409,
          "نسخهٔ سفارش تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.",
        );
      if (
        current.orderStatus === "CANCELLED" ||
        current.orderStatus === "REJECTED"
      ) {
        orderError(
          "ORDER_PAYMENT_REQUIRED",
          409,
          "ثبت پرداخت برای سفارش لغوشده مجاز نیست.",
        );
      }
      await transaction.orderPayment.create({
        data: {
          orderId: current.id,
          provider: input.provider,
          method: input.method,
          amountRials: current.grandTotalRials,
          status: "PAID",
          idempotencyKey: input.idempotencyKey,
          ...(input.providerReference === undefined ||
          input.providerReference === null
            ? {}
            : { providerReference: input.providerReference }),
        },
      });
      const canComplete =
        current.orderStatus === "PROCESSING" &&
        current.fulfillmentStatus === "DELIVERED";
      const nextStatus = canComplete ? "COMPLETED" : current.orderStatus;
      const result = await transaction.order.updateMany({
        where: { id: current.id, version: input.expectedVersion },
        data: {
          paymentStatus: "PAID",
          orderStatus: nextStatus,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1)
        orderError(
          "ORDER_VERSION_CONFLICT",
          409,
          "سفارش هم‌زمان تغییر کرده است.",
        );
      const version = input.expectedVersion + 1;
      if (canComplete) {
        await assertOrderStatusTransitionWithRejectionAudit({
          actor,
          context,
          order: current,
          transition: {
            fromStatus: "PROCESSING",
            toStatus: "COMPLETED",
            context: { fulfillmentStatus: "DELIVERED", paymentStatus: "PAID" },
          },
        });
        await writeStatusHistory(transaction, {
          orderId: current.id,
          fromStatus: "PROCESSING",
          toStatus: "COMPLETED",
          actor,
          context,
          version,
        });
      }
      await writeAudit(transaction, {
        actor,
        context,
        action: "order.payment.recorded",
        order: {
          id: current.id,
          orderNumber: current.orderNumber,
          orderStatus: nextStatus,
          version,
        },
        after: { paymentStatus: "PAID" },
      });
      await writeOutboxEvent(transaction, {
        orderId: current.id,
        eventType: "order.payment_completed",
        aggregateVersion: version,
        orderNumber: current.orderNumber,
        status: nextStatus,
        allocationStatus: current.allocationStatus,
      });
      if (canComplete) {
        await writeOutboxEvent(transaction, {
          orderId: current.id,
          eventType: "order.completed",
          aggregateVersion: version,
          orderNumber: current.orderNumber,
          status: "COMPLETED",
          allocationStatus: current.allocationStatus,
        });
      }
      const updated = ensureOrderRecord(
        await orderRepository.findOrderById(current.id, transaction),
      );
      await createCommandIdempotencyRecord(transaction, {
        scope,
        key: input.idempotencyKey,
        hash,
        order: updated,
      });
      return updated;
    },
  });
  return mapOrderDetail(
    record,
    hasPermission(actor, "orders.audit.read") ||
      hasPermission(actor, "orders.add_internal_note"),
    true,
    hasPermission(actor, "orders.view_customer_pii"),
    hasPermission(actor, "orders.view_imei"),
  );
}

export async function addOrderNote(
  actor: SessionActor,
  id: string,
  input: CreateOrderNoteInput,
  context: OrderAuditContext,
): Promise<OrderDetailDto> {
  if (input.visibility === "INTERNAL")
    requirePermission(actor, "orders.add_internal_note");
  else requirePermission(actor, "orders.update");
  const scope = `order:${id}:note:${actor.id}`;
  const hash = requestHash({ actorId: actor.id, id, input });
  const record = await executeIdempotentOrderCommand({
    operation: "note",
    scope,
    key: input.idempotencyKey,
    hash,
    execute: async (transaction) => {
      const current = ensureOrderRecord(
        await orderRepository.findOrderById(id, transaction),
      );
      await assertOrderBranchScope(actor, current);
      await transaction.orderNote.create({
        data: {
          orderId: current.id,
          visibility: input.visibility,
          content: input.content,
          authorId: actor.id,
        },
      });
      await writeAudit(transaction, {
        actor,
        context,
        action: "order.note.created",
        order: {
          id: current.id,
          orderNumber: current.orderNumber,
          orderStatus: current.orderStatus,
          version: current.version,
        },
        after: { visibility: input.visibility },
      });
      const updated = ensureOrderRecord(
        await orderRepository.findOrderById(current.id, transaction),
      );
      await createCommandIdempotencyRecord(transaction, {
        scope,
        key: input.idempotencyKey,
        hash,
        order: updated,
      });
      return updated;
    },
  });
  return mapOrderDetail(
    record,
    hasPermission(actor, "orders.audit.read") ||
      hasPermission(actor, "orders.add_internal_note"),
    hasPermission(actor, "orders.view_financials"),
    hasPermission(actor, "orders.view_customer_pii"),
    hasPermission(actor, "orders.view_imei"),
  );
}

export type ExpireOrderReservationsResult = Readonly<{
  ordersChecked: number;
  ordersReleased: number;
  reservationsReleased: number;
}>;

/**
 * Releases only pre-confirmation reservations that have genuinely expired.
 * This is intentionally a callable worker operation rather than a request
 * handler: hosts can schedule it after supplying their own guarded runtime
 * environment, while reconciliation can use the same deterministic policy.
 */
export async function expireDueOrderReservations(
  now = new Date(),
  limit = 100,
): Promise<ExpireOrderReservationsResult> {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 1_000);
  const candidates = await prisma.order.findMany({
    where: {
      orderStatus: "PENDING_CONFIRMATION",
      allocations: {
        some: {
          status: "ALLOCATED",
          reservation: { is: { status: "ACTIVE", expiresAt: { lte: now } } },
        },
      },
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: boundedLimit,
    select: { id: true },
  });

  let ordersReleased = 0;
  let reservationsReleased = 0;
  for (const candidate of candidates) {
    const releasedForOrder = await runOrderTransaction(async (transaction) => {
      const current = ensureOrderRecord(
        await orderRepository.findOrderById(candidate.id, transaction),
      );
      if (current.orderStatus !== "PENDING_CONFIRMATION") return 0;
      const expiredAllocations = current.allocations.filter(
        (allocation) =>
          allocation.status === "ALLOCATED" &&
          allocation.reservation?.status === "ACTIVE" &&
          allocation.reservation.expiresAt !== null &&
          allocation.reservation.expiresAt <= now &&
          allocation.reservationId !== null,
      );
      if (expiredAllocations.length === 0) return 0;

      for (const allocation of expiredAllocations) {
        await releaseOrderInventory(
          {
            orderId: current.id,
            orderNumber: current.orderNumber,
            orderItemId: allocation.orderItemId,
            reservationId: allocation.reservationId as string,
            inventoryItemId: allocation.inventoryItemId,
            quantity: allocation.quantity,
            releaseStatus: "EXPIRED",
          },
          transaction,
        );
        await transitionOrderDeviceAssignments(
          transaction,
          allocation,
          "RELEASED",
          now,
        );
        const marked = await transaction.orderAllocation.updateMany({
          where: { id: allocation.id, status: "ALLOCATED" },
          data: { status: "RELEASED" },
        });
        if (marked.count !== 1)
          orderError(
            "ORDER_VERSION_CONFLICT",
            409,
            "تخصیص سفارش هم‌زمان تغییر کرده است.",
          );
      }

      const expiredAllocationIds = new Set(
        expiredAllocations.map((allocation) => allocation.id),
      );
      const remainingActive = current.allocations.filter(
        (allocation) =>
          allocation.status === "ALLOCATED" &&
          !expiredAllocationIds.has(allocation.id),
      ).length;
      const allocationStatus =
        remainingActive === 0 ? "RELEASED" : "PARTIALLY_ALLOCATED";
      const update = await transaction.order.updateMany({
        where: {
          id: current.id,
          version: current.version,
          orderStatus: "PENDING_CONFIRMATION",
        },
        data: { allocationStatus, version: { increment: 1 } },
      });
      if (update.count !== 1)
        orderError(
          "ORDER_VERSION_CONFLICT",
          409,
          "سفارش هم‌زمان تغییر کرده است.",
        );
      const version = current.version + 1;
      await transaction.auditLog.create({
        data: {
          actorType: "SYSTEM",
          action: "order.reservation.expired",
          entityType: "Order",
          entityId: current.id,
          requestId: `order-expiry-${current.id}-${version}`,
          reasonCode: "RESERVATION_EXPIRED",
          metadata: {
            orderNumber: current.orderNumber,
            releasedReservationCount: expiredAllocations.length,
          },
          beforeSnapshot: { allocationStatus: current.allocationStatus },
          afterSnapshot: { allocationStatus },
        },
      });
      await writeOutboxEvent(transaction, {
        orderId: current.id,
        eventType: "order.inventory_released",
        aggregateVersion: version,
        orderNumber: current.orderNumber,
        status: current.orderStatus,
        allocationStatus,
      });
      return expiredAllocations.length;
    });
    if (releasedForOrder > 0) {
      ordersReleased += 1;
      reservationsReleased += releasedForOrder;
    }
  }
  return {
    ordersChecked: candidates.length,
    ordersReleased,
    reservationsReleased,
  };
}
