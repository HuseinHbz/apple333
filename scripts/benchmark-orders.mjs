import { PrismaClient } from "@prisma/client";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { ORDER_E2E_ACTORS, ORDER_E2E_FIXTURES } from "./order-e2e-fixtures.mjs";
import { PHASE_07_ORDER_MIGRATION } from "./inspect-order-test-database.mjs";
import { sanitizeE2eLog } from "./sanitize-e2e-log.mjs";
import { validateOrderTestEnvironment } from "./verify-order-test-environment.mjs";

export const ORDER_BENCHMARK_SCALES = Object.freeze([10_000, 100_000]);
export const ORDER_BENCHMARK_BRANCH_COUNT = 4;
export const ORDER_BENCHMARK_CUSTOMER_COUNT = 24;
export const ORDER_BENCHMARK_P95_TARGETS_MS = Object.freeze({
  adminOrderList: 250,
  customerOrderList: 200,
  branchOrderList: 250,
  orderDetail: 200,
  orderNumberSearch: 100,
  createOrder: 500,
  confirmOrder: 500,
});
export const ORDER_BENCHMARK_SQL_QUERIES = Object.freeze({
  adminOrderList:
    'SELECT "id", "orderNumber", "paymentStatus", "fulfillmentStatus", "createdAt" FROM "Order" WHERE "orderStatus" = $1::"OrderStatus" ORDER BY "createdAt" DESC, "id" DESC LIMIT 25',
  customerOrderList:
    'SELECT "id", "orderNumber", "orderStatus", "createdAt" FROM "Order" WHERE "customerId" = $1 ORDER BY "createdAt" DESC, "id" DESC LIMIT 25',
  branchOrderList:
    'SELECT o."id", o."orderNumber" FROM "Order" AS o INNER JOIN "OrderAllocation" AS a ON a."orderId" = o."id" WHERE a."branchId" = $1 ORDER BY o."createdAt" DESC, o."id" DESC LIMIT 25',
  orderNumberSearch:
    'SELECT "id", "orderNumber" FROM "Order" WHERE "orderNumber" = $1',
});

const DEFAULT_BATCH_SIZE = 1_000;
const DEFAULT_SAMPLE_COUNT = 30;
const ACTION_RESERVATION_HEADROOM = 8;

function parseBoundedInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a whole number.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

export function parseOrderBenchmarkArguments(
  argumentsList = process.argv.slice(2),
) {
  if (
    argumentsList.length === 0 ||
    (argumentsList.length === 1 && argumentsList[0] === "--help")
  ) {
    return { help: true };
  }
  if (
    argumentsList.length === 3 &&
    argumentsList[0] === "--execute" &&
    argumentsList[1] === "--scale"
  ) {
    const scale = Number(argumentsList[2]);
    if (!ORDER_BENCHMARK_SCALES.includes(scale)) {
      throw new Error("--scale must be exactly 10000 or 100000.");
    }
    return { help: false, scale };
  }
  throw new Error("Use --execute --scale <10000|100000>, or use --help.");
}

export function validateOrderBenchmarkEnvironment(environment = process.env) {
  const preflight = validateOrderTestEnvironment(environment);
  const errors = [...preflight.errors];
  if (environment.ORDER_BENCHMARK_ALLOW_SEED !== "1") {
    errors.push('ORDER_BENCHMARK_ALLOW_SEED must be exactly "1".');
  }
  if (
    !/^[a-z0-9](?:[a-z0-9-]{6,38}[a-z0-9])?$/.test(
      environment.ORDER_BENCHMARK_RUN_ID ?? "",
    )
  ) {
    errors.push(
      "ORDER_BENCHMARK_RUN_ID must be 8-40 lowercase letters, digits, or hyphens.",
    );
  }
  for (const [value, fallback, minimum, maximum, name] of [
    [
      environment.ORDER_BENCHMARK_BATCH_SIZE,
      DEFAULT_BATCH_SIZE,
      100,
      5_000,
      "ORDER_BENCHMARK_BATCH_SIZE",
    ],
    [
      environment.ORDER_BENCHMARK_SAMPLE_COUNT,
      DEFAULT_SAMPLE_COUNT,
      10,
      100,
      "ORDER_BENCHMARK_SAMPLE_COUNT",
    ],
  ]) {
    try {
      parseBoundedInteger(value, fallback, minimum, maximum, name);
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : `${name} is invalid.`,
      );
    }
  }
  return { ok: errors.length === 0, errors };
}

function optionsFromEnvironment(environment = process.env) {
  return {
    runId: environment.ORDER_BENCHMARK_RUN_ID,
    batchSize: parseBoundedInteger(
      environment.ORDER_BENCHMARK_BATCH_SIZE,
      DEFAULT_BATCH_SIZE,
      100,
      5_000,
      "ORDER_BENCHMARK_BATCH_SIZE",
    ),
    samples: parseBoundedInteger(
      environment.ORDER_BENCHMARK_SAMPLE_COUNT,
      DEFAULT_SAMPLE_COUNT,
      10,
      100,
      "ORDER_BENCHMARK_SAMPLE_COUNT",
    ),
  };
}

function benchmarkContext(runId) {
  const idPrefix = `phase07-order-benchmark-${runId}`;
  const orderPrefix = `A33-B07-${runId.toUpperCase()}-`;
  const branchCodePrefix = `B07BENCH-${runId.toUpperCase()}`;
  const padded = (ordinal) => String(ordinal).padStart(6, "0");

  return {
    idPrefix,
    marker: `phase07-order-benchmark:${runId}`,
    orderPrefix,
    branchCodePrefix,
    orderId: (ordinal) => `${idPrefix}-order-${padded(ordinal)}`,
    itemId: (ordinal) => `${idPrefix}-item-${padded(ordinal)}`,
    allocationId: (ordinal) => `${idPrefix}-allocation-${padded(ordinal)}`,
    paymentId: (ordinal) => `${idPrefix}-payment-${padded(ordinal)}`,
    reservationId: (ordinal) => `${idPrefix}-reservation-${padded(ordinal)}`,
    fulfillmentId: (ordinal) => `${idPrefix}-fulfillment-${padded(ordinal)}`,
    historyId: (ordinal) => `${idPrefix}-history-${padded(ordinal)}`,
    outboxEventId: (ordinal) => `${idPrefix}-outbox-${padded(ordinal)}`,
    idempotencyRecordId: (ordinal) =>
      `${idPrefix}-idempotency-${padded(ordinal)}`,
    orderNumber: (ordinal) =>
      `${orderPrefix}${String(ordinal).padStart(8, "0")}`,
    branchId: (index) => `${idPrefix}-branch-${index}`,
    warehouseId: (index) => `${idPrefix}-warehouse-${index}`,
    locationId: (index) => `${idPrefix}-location-${index}`,
    inventoryItemId: (index) => `${idPrefix}-inventory-item-${index}`,
    customerId: (index) =>
      `${idPrefix}-customer-${String(index).padStart(2, "0")}`,
    customerEmail: (index) =>
      `${idPrefix}-customer-${String(index).padStart(2, "0")}@example.test`,
    actionOrderId: (ordinal) => `${idPrefix}-write-order-${padded(ordinal)}`,
    actionItemId: (ordinal) => `${idPrefix}-write-item-${padded(ordinal)}`,
    actionAllocationId: (ordinal) =>
      `${idPrefix}-write-allocation-${padded(ordinal)}`,
    actionReservationId: (ordinal) =>
      `${idPrefix}-write-reservation-${padded(ordinal)}`,
    actionOrderNumber: (ordinal) =>
      `${orderPrefix}WRITE-${String(ordinal).padStart(6, "0")}`,
  };
}

function branchIndexForOrdinal(ordinal) {
  return ((ordinal - 1) % ORDER_BENCHMARK_BRANCH_COUNT) + 1;
}

function customerIndexForOrdinal(ordinal) {
  return ((ordinal - 1) % ORDER_BENCHMARK_CUSTOMER_COUNT) + 1;
}

function sourceForOrdinal(ordinal) {
  const bucket = ((ordinal * 37) % 100) + 1;
  if (bucket <= 45) return "STOREFRONT";
  if (bucket <= 70) return "BRANCH_POS";
  if (bucket <= 85) return "ADMIN";
  if (bucket <= 95) return "CALL_CENTER";
  if (bucket <= 98) return "API";
  return "IMPORT";
}

/**
 * Deterministic, reconciliation-safe order state distribution. It deliberately
 * includes live reservations, completed delivery, released allocations, and
 * allocation failures instead of treating all benchmark rows as cancelled.
 */
export function orderBenchmarkLifecycle(ordinal) {
  const bucket = ((ordinal - 1) % 100) + 1;
  if (bucket <= 28) {
    return {
      orderStatus: "COMPLETED",
      allocationStatus: "ALLOCATED",
      allocationRecordStatus: "ALLOCATED",
      paymentStatus: "PAID",
      fulfillmentStatus: "DELIVERED",
      reservationStatus: "FULFILLED",
      hasFulfillment: true,
    };
  }
  if (bucket <= 48) {
    return {
      orderStatus: "CONFIRMED",
      allocationStatus: "ALLOCATED",
      allocationRecordStatus: "ALLOCATED",
      paymentStatus: "AUTHORIZED",
      fulfillmentStatus: "UNFULFILLED",
      reservationStatus: "ACTIVE",
      hasFulfillment: false,
    };
  }
  if (bucket <= 63) {
    return {
      orderStatus: "PROCESSING",
      allocationStatus: "ALLOCATED",
      allocationRecordStatus: "ALLOCATED",
      paymentStatus: "PAID",
      fulfillmentStatus: "PICKING",
      reservationStatus: "ACTIVE",
      hasFulfillment: true,
    };
  }
  if (bucket <= 80) {
    return {
      orderStatus: "PENDING_CONFIRMATION",
      allocationStatus: "ALLOCATED",
      allocationRecordStatus: "ALLOCATED",
      paymentStatus: "UNPAID",
      fulfillmentStatus: "UNFULFILLED",
      reservationStatus: "ACTIVE",
      hasFulfillment: false,
    };
  }
  if (bucket <= 95) {
    return {
      orderStatus: "CANCELLED",
      allocationStatus: "RELEASED",
      allocationRecordStatus: "RELEASED",
      paymentStatus: "CANCELLED",
      fulfillmentStatus: "UNFULFILLED",
      reservationStatus: null,
      hasFulfillment: false,
    };
  }
  return {
    orderStatus: "REJECTED",
    allocationStatus: "ALLOCATION_FAILED",
    allocationRecordStatus: "UNALLOCATED",
    paymentStatus: "FAILED",
    fulfillmentStatus: "UNFULFILLED",
    reservationStatus: null,
    hasFulfillment: false,
  };
}

function fulfillmentMethodForOrdinal(ordinal) {
  return ordinal % 10 < 6 ? "PICKUP" : "DELIVERY";
}

function incrementCount(record, key) {
  record[key] = (record[key] ?? 0) + 1;
}

export function orderBenchmarkDatasetDistribution(scale) {
  const sources = {};
  const statuses = {};
  const allocationStatuses = {};
  const paymentStatuses = {};
  const fulfillmentStatuses = {};
  const fulfillmentMethods = {};
  const branches = Object.fromEntries(
    Array.from({ length: ORDER_BENCHMARK_BRANCH_COUNT }, (_, index) => [
      String(index + 1),
      { orders: 0, activeReservations: 0 },
    ]),
  );

  for (let ordinal = 1; ordinal <= scale; ordinal += 1) {
    const lifecycle = orderBenchmarkLifecycle(ordinal);
    const branch = branches[String(branchIndexForOrdinal(ordinal))];
    if (!branch) throw new Error("Benchmark branch distribution is invalid.");

    branch.orders += 1;
    if (lifecycle.reservationStatus === "ACTIVE") {
      branch.activeReservations += 1;
    }
    incrementCount(sources, sourceForOrdinal(ordinal));
    incrementCount(statuses, lifecycle.orderStatus);
    incrementCount(allocationStatuses, lifecycle.allocationStatus);
    incrementCount(paymentStatuses, lifecycle.paymentStatus);
    incrementCount(fulfillmentStatuses, lifecycle.fulfillmentStatus);
    incrementCount(fulfillmentMethods, fulfillmentMethodForOrdinal(ordinal));
  }

  return {
    orders: scale,
    branches: ORDER_BENCHMARK_BRANCH_COUNT,
    syntheticCustomers: ORDER_BENCHMARK_CUSTOMER_COUNT,
    sources,
    orderStatuses: statuses,
    allocationStatuses,
    paymentStatuses,
    fulfillmentStatuses,
    fulfillmentMethods,
    branchLoad: branches,
  };
}

export function percentile(values, quantile) {
  if (values.length === 0) {
    throw new Error("Cannot calculate a percentile for an empty sample set.");
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * quantile) - 1),
  );
  const value = sorted[index];
  if (value === undefined) throw new Error("Benchmark percentile is invalid.");
  return Number(value.toFixed(3));
}

export function summarizeBenchmarkSamples(values) {
  return {
    samples: values.length,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    p99Ms: percentile(values, 0.99),
    minMs: Number(Math.min(...values).toFixed(3)),
    maxMs: Number(Math.max(...values).toFixed(3)),
  };
}

async function timeSamples(callback, count) {
  await callback();
  const values = [];
  for (let index = 0; index < count; index += 1) {
    const startedAt = performance.now();
    await callback();
    values.push(performance.now() - startedAt);
  }
  return summarizeBenchmarkSamples(values);
}

async function assertMigratedSeed(prisma) {
  const [migration, customer, product, variant, sku, inventoryItem] =
    await Promise.all([
      prisma.$queryRaw`SELECT migration_name AS name FROM "_prisma_migrations" WHERE migration_name = ${PHASE_07_ORDER_MIGRATION} AND finished_at IS NOT NULL LIMIT 1`,
      prisma.user.findUnique({
        where: { id: ORDER_E2E_ACTORS.CUSTOMER.id },
        select: { id: true },
      }),
      prisma.catalogProduct.findUnique({
        where: { id: ORDER_E2E_FIXTURES.product.id },
        select: { id: true },
      }),
      prisma.catalogVariant.findUnique({
        where: { id: ORDER_E2E_FIXTURES.variant.id },
        select: { id: true },
      }),
      prisma.productSku.findUnique({
        where: { id: ORDER_E2E_FIXTURES.productSku.id },
        select: { id: true },
      }),
      prisma.inventoryItem.findUnique({
        where: { id: ORDER_E2E_FIXTURES.inventoryItem.id },
        select: { id: true },
      }),
    ]);
  if (
    !Array.isArray(migration) ||
    migration.length !== 1 ||
    !customer ||
    !product ||
    !variant ||
    !sku ||
    !inventoryItem
  ) {
    throw new Error(
      "Order benchmark requires the migrated Phase 07 disposable database and deterministic fixtures from pnpm order:test:seed.",
    );
  }
}

async function assertUnusedRun(prisma, context) {
  const [orders, branches, customers, idempotencyRecords] = await Promise.all([
    prisma.order.count({
      where: { orderNumber: { startsWith: context.orderPrefix } },
    }),
    prisma.branch.count({
      where: { code: { startsWith: context.branchCodePrefix } },
    }),
    prisma.user.count({
      where: { email: { startsWith: `${context.idPrefix}-customer-` } },
    }),
    prisma.orderIdempotencyRecord.count({
      where: { scope: { contains: context.idPrefix } },
    }),
  ]);
  if (
    orders !== 0 ||
    branches !== 0 ||
    customers !== 0 ||
    idempotencyRecords !== 0
  ) {
    throw new Error(
      "This ORDER_BENCHMARK_RUN_ID already has retained or partial records. Choose a new run id; existing evidence is never deleted.",
    );
  }
}

function benchmarkReference(context, ordinal) {
  const branchIndex = branchIndexForOrdinal(ordinal);
  return {
    branchIndex,
    branchId: context.branchId(branchIndex),
    warehouseId: context.warehouseId(branchIndex),
    inventoryItemId: context.inventoryItemId(branchIndex),
    customerIndex: customerIndexForOrdinal(ordinal),
    customerId: context.customerId(customerIndexForOrdinal(ordinal)),
  };
}

async function seedBenchmarkReferences(prisma, context, scale, samples) {
  const distribution = orderBenchmarkDatasetDistribution(scale);
  const inventoryQuantity = scale + samples + ACTION_RESERVATION_HEADROOM;
  const branches = Array.from(
    { length: ORDER_BENCHMARK_BRANCH_COUNT },
    (_, offset) => {
      const index = offset + 1;
      const branchLoad = distribution.branchLoad[String(index)];
      if (!branchLoad) throw new Error("Benchmark branch load is invalid.");
      return {
        index,
        activeReservations: branchLoad.activeReservations,
      };
    },
  );

  await prisma.$transaction(
    async (transaction) => {
      await transaction.user.createMany({
        data: Array.from(
          { length: ORDER_BENCHMARK_CUSTOMER_COUNT },
          (_, offset) => {
            const index = offset + 1;
            return {
              id: context.customerId(index),
              email: context.customerEmail(index),
              name: "Phase 07 benchmark customer",
              status: "ACTIVE",
            };
          },
        ),
      });
      await transaction.branch.createMany({
        data: branches.map(({ index }) => ({
          id: context.branchId(index),
          code: `${context.branchCodePrefix}-${index}`,
          name: `Phase 07 benchmark branch ${index}`,
          kind: "STORE",
          status: "ACTIVE",
          isActive: true,
          isPickupEnabled: true,
        })),
      });
      await transaction.warehouse.createMany({
        data: branches.map(({ index }) => ({
          id: context.warehouseId(index),
          branchId: context.branchId(index),
          code: "BENCHMARK",
          name: `Phase 07 benchmark warehouse ${index}`,
          status: "ACTIVE",
        })),
      });
      await transaction.inventoryLocation.createMany({
        data: branches.map(({ index }) => ({
          id: context.locationId(index),
          warehouseId: context.warehouseId(index),
          code: "STORAGE",
          name: `Phase 07 benchmark storage ${index}`,
          type: "STORAGE",
          status: "ACTIVE",
        })),
      });
      await transaction.inventoryItem.createMany({
        data: branches.map(({ index, activeReservations }) => ({
          id: context.inventoryItemId(index),
          warehouseId: context.warehouseId(index),
          locationId: context.locationId(index),
          skuId: ORDER_E2E_FIXTURES.productSku.id,
          quantity: inventoryQuantity,
          reservedQuantity: activeReservations,
          availableQuantity: inventoryQuantity - activeReservations,
          version: 1,
        })),
      });
      await transaction.branchInventory.createMany({
        data: branches.map(({ index, activeReservations }) => ({
          branchId: context.branchId(index),
          variantId: ORDER_E2E_FIXTURES.variant.id,
          onHand: inventoryQuantity,
          reserved: activeReservations,
        })),
      });
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
  return distribution;
}

/** Builds a lifecycle-complete, non-PII dataset for real PostgreSQL only. */
export function buildOrderBenchmarkBatch(context, startOrdinal, count) {
  const createdAt = new Date();
  const activeReservationExpiresAt = new Date(
    createdAt.getTime() + 72 * 60 * 60 * 1_000,
  );
  const orders = [];
  const items = [];
  const allocations = [];
  const reservations = [];
  const payments = [];
  const fulfillments = [];
  const history = [];
  const outboxEvents = [];
  const idempotencyRecords = [];

  for (let offset = 0; offset < count; offset += 1) {
    const ordinal = startOrdinal + offset;
    const timestamp = new Date(createdAt.getTime() - ordinal * 60_000);
    const lifecycle = orderBenchmarkLifecycle(ordinal);
    const reference = benchmarkReference(context, ordinal);
    const fulfillmentMethod = fulfillmentMethodForOrdinal(ordinal);
    const id = context.orderId(ordinal);
    const itemId = context.itemId(ordinal);
    const orderNumber = context.orderNumber(ordinal);
    const priceRials = ORDER_E2E_FIXTURES.variant.priceRials;
    const reservationId = lifecycle.reservationStatus
      ? context.reservationId(ordinal)
      : null;

    orders.push({
      id,
      orderNumber,
      source: sourceForOrdinal(ordinal),
      type: fulfillmentMethod === "PICKUP" ? "PICKUP" : "DELIVERY",
      customerId: reference.customerId,
      customerSnapshot: {
        benchmark: "phase07-order",
        customerIndex: reference.customerIndex,
      },
      ...(fulfillmentMethod === "DELIVERY"
        ? {
            shippingAddressSnapshot: {
              benchmark: "phase07-order",
              city: "Tehran",
              postalCode: "0000000000",
            },
          }
        : {}),
      currency: "IRR",
      subtotalRials: priceRials,
      discountTotalRials: 0n,
      taxTotalRials: 0n,
      shippingTotalRials: 0n,
      feeTotalRials: 0n,
      grandTotalRials: priceRials,
      paymentStatus: lifecycle.paymentStatus,
      fulfillmentStatus: lifecycle.fulfillmentStatus,
      fulfillmentMethod,
      orderStatus: lifecycle.orderStatus,
      allocationStatus: lifecycle.allocationStatus,
      version: 2,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    items.push({
      id: itemId,
      orderId: id,
      productId: ORDER_E2E_FIXTURES.product.id,
      variantId: ORDER_E2E_FIXTURES.variant.id,
      productSkuId: ORDER_E2E_FIXTURES.productSku.id,
      sku: ORDER_E2E_FIXTURES.productSku.code,
      productName: ORDER_E2E_FIXTURES.product.name,
      variantName: ORDER_E2E_FIXTURES.variant.title,
      quantity: 1,
      unitPriceRials: priceRials,
      discountAmountRials: 0n,
      taxAmountRials: 0n,
      lineTotalRials: priceRials,
      attributesSnapshot: {
        benchmark: "phase07-order",
        marker: context.marker,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    if (reservationId && lifecycle.reservationStatus) {
      reservations.push({
        id: reservationId,
        inventoryItemId: reference.inventoryItemId,
        quantity: 1,
        status: lifecycle.reservationStatus,
        ...(lifecycle.reservationStatus === "ACTIVE"
          ? { expiresAt: activeReservationExpiresAt }
          : {}),
        reference: `order:${orderNumber}:item:${itemId}`,
        idempotencyKey: `benchmark:reservation:${id}`,
        createdById: ORDER_E2E_ACTORS.ORDER_MANAGER.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
    allocations.push({
      id: context.allocationId(ordinal),
      orderId: id,
      orderItemId: itemId,
      branchId: reference.branchId,
      warehouseId: reference.warehouseId,
      inventoryItemId: reference.inventoryItemId,
      ...(reservationId ? { reservationId } : {}),
      quantity: 1,
      status: lifecycle.allocationRecordStatus,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    payments.push({
      id: context.paymentId(ordinal),
      orderId: id,
      provider: "PHASE07_BENCHMARK",
      method: "MANUAL_REVIEW",
      amountRials: priceRials,
      status: lifecycle.paymentStatus,
      idempotencyKey: `benchmark:payment:${id}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    if (lifecycle.hasFulfillment) {
      fulfillments.push({
        id: context.fulfillmentId(ordinal),
        orderId: id,
        method: fulfillmentMethod,
        branchId: reference.branchId,
        warehouseId: reference.warehouseId,
        status: lifecycle.fulfillmentStatus,
        ...(lifecycle.fulfillmentStatus === "DELIVERED"
          ? { deliveredAt: timestamp }
          : { preparedAt: timestamp }),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
    history.push({
      id: context.historyId(ordinal),
      orderId: id,
      fromStatus: "DRAFT",
      toStatus: lifecycle.orderStatus,
      actorType: "SYSTEM",
      reasonCode: `BENCHMARK_SYNTHETIC_${lifecycle.orderStatus}`,
      requestId: `benchmark:history:${id}`,
      version: 2,
      createdAt: timestamp,
    });
    outboxEvents.push({
      id: context.outboxEventId(ordinal),
      orderId: id,
      eventType: "order.created",
      aggregateVersion: 2,
      schemaVersion: 1,
      payload: {
        orderNumber,
        status: lifecycle.orderStatus,
        allocationStatus: lifecycle.allocationStatus,
        benchmark: "phase07-order",
      },
      occurredAt: timestamp,
      status: "PENDING",
      availableAt: timestamp,
      attempts: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    idempotencyRecords.push({
      id: context.idempotencyRecordId(ordinal),
      scope: `benchmark:seed:${reference.customerId}`,
      key: `benchmark:seed:${id}`,
      requestHash: `benchmark-seed-${id}`,
      responseReference: orderNumber,
      orderId: id,
      expiresAt: new Date(timestamp.getTime() + 24 * 60 * 60 * 1_000),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return {
    orders,
    items,
    allocations,
    reservations,
    payments,
    fulfillments,
    history,
    outboxEvents,
    idempotencyRecords,
  };
}

async function seedScale(prisma, context, scale, batchSize) {
  const startedAt = performance.now();
  for (let startOrdinal = 1; startOrdinal <= scale; startOrdinal += batchSize) {
    const count = Math.min(batchSize, scale - startOrdinal + 1);
    const batch = buildOrderBenchmarkBatch(context, startOrdinal, count);
    await prisma.$transaction(
      async (transaction) => {
        await transaction.order.createMany({ data: batch.orders });
        await transaction.orderItem.createMany({ data: batch.items });
        await transaction.inventoryReservation.createMany({
          data: batch.reservations,
        });
        await transaction.orderAllocation.createMany({
          data: batch.allocations,
        });
        await transaction.orderPayment.createMany({ data: batch.payments });
        if (batch.fulfillments.length > 0) {
          await transaction.orderFulfillment.createMany({
            data: batch.fulfillments,
          });
        }
        await transaction.orderStatusHistory.createMany({
          data: batch.history,
        });
        await transaction.orderOutboxEvent.createMany({
          data: batch.outboxEvents,
        });
        await transaction.orderIdempotencyRecord.createMany({
          data: batch.idempotencyRecords,
        });
      },
      { maxWait: 10_000, timeout: 60_000 },
    );
  }
  return Number((performance.now() - startedAt).toFixed(3));
}

async function createOrderPersistenceSample(prisma, context, ordinal) {
  const reference = benchmarkReference(context, ordinal);
  const orderId = context.actionOrderId(ordinal);
  const itemId = context.actionItemId(ordinal);
  const allocationId = context.actionAllocationId(ordinal);
  const reservationId = context.actionReservationId(ordinal);
  const orderNumber = context.actionOrderNumber(ordinal);
  const priceRials = ORDER_E2E_FIXTURES.variant.priceRials;
  const now = new Date();

  return prisma.$transaction(
    async (transaction) => {
      const inventory = await transaction.inventoryItem.findUnique({
        where: { id: reference.inventoryItemId },
        select: { id: true, version: true },
      });
      if (!inventory) {
        throw new Error("Benchmark inventory reference is missing.");
      }
      const reservedInventory = await transaction.inventoryItem.updateMany({
        where: {
          id: inventory.id,
          version: inventory.version,
          availableQuantity: { gte: 1 },
        },
        data: {
          reservedQuantity: { increment: 1 },
          availableQuantity: { decrement: 1 },
          version: { increment: 1 },
        },
      });
      if (reservedInventory.count !== 1) {
        throw new Error("Benchmark inventory reservation conflicted.");
      }
      await transaction.branchInventory.update({
        where: {
          branchId_variantId: {
            branchId: reference.branchId,
            variantId: ORDER_E2E_FIXTURES.variant.id,
          },
        },
        data: { reserved: { increment: 1 } },
      });

      await transaction.order.create({
        data: {
          id: orderId,
          orderNumber,
          source: "ADMIN",
          type: "PICKUP",
          customerId: reference.customerId,
          customerSnapshot: {
            benchmark: "phase07-order",
            customerIndex: reference.customerIndex,
          },
          currency: "IRR",
          subtotalRials: priceRials,
          discountTotalRials: 0n,
          taxTotalRials: 0n,
          shippingTotalRials: 0n,
          feeTotalRials: 0n,
          grandTotalRials: priceRials,
          paymentStatus: "UNPAID",
          fulfillmentStatus: "UNFULFILLED",
          fulfillmentMethod: "PICKUP",
          orderStatus: "DRAFT",
          allocationStatus: "UNALLOCATED",
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
      });
      await transaction.orderItem.create({
        data: {
          id: itemId,
          orderId,
          productId: ORDER_E2E_FIXTURES.product.id,
          variantId: ORDER_E2E_FIXTURES.variant.id,
          productSkuId: ORDER_E2E_FIXTURES.productSku.id,
          sku: ORDER_E2E_FIXTURES.productSku.code,
          productName: ORDER_E2E_FIXTURES.product.name,
          variantName: ORDER_E2E_FIXTURES.variant.title,
          quantity: 1,
          unitPriceRials: priceRials,
          discountAmountRials: 0n,
          taxAmountRials: 0n,
          lineTotalRials: priceRials,
          attributesSnapshot: {
            benchmark: "phase07-order",
            marker: context.marker,
          },
          createdAt: now,
          updatedAt: now,
        },
      });
      await transaction.inventoryReservation.create({
        data: {
          id: reservationId,
          inventoryItemId: reference.inventoryItemId,
          quantity: 1,
          status: "ACTIVE",
          expiresAt: new Date(now.getTime() + 15 * 60 * 1_000),
          reference: `order:${orderNumber}:item:${itemId}`,
          idempotencyKey: `benchmark:write:reservation:${orderId}`,
          createdById: ORDER_E2E_ACTORS.ORDER_MANAGER.id,
          createdAt: now,
          updatedAt: now,
        },
      });
      await transaction.stockMovement.create({
        data: {
          skuId: ORDER_E2E_FIXTURES.productSku.id,
          fromLocationId: context.locationId(reference.branchIndex),
          quantity: 1,
          type: "SALE_RESERVED",
          adjustmentDirection: "DECREASE",
          reference: `order:${orderNumber}`,
          idempotencyKey: `benchmark:write:movement:${orderId}`,
          performedById: ORDER_E2E_ACTORS.ORDER_MANAGER.id,
          metadata: {
            benchmark: "phase07-order",
            orderId,
            reservationId,
          },
          createdAt: now,
        },
      });
      await transaction.orderAllocation.create({
        data: {
          id: allocationId,
          orderId,
          orderItemId: itemId,
          branchId: reference.branchId,
          warehouseId: reference.warehouseId,
          inventoryItemId: reference.inventoryItemId,
          reservationId,
          quantity: 1,
          status: "ALLOCATED",
          createdAt: now,
          updatedAt: now,
        },
      });
      const transitioned = await transaction.order.updateMany({
        where: { id: orderId, version: 1, orderStatus: "DRAFT" },
        data: {
          orderStatus: "PENDING_CONFIRMATION",
          allocationStatus: "ALLOCATED",
          version: { increment: 1 },
        },
      });
      if (transitioned.count !== 1) {
        throw new Error(
          "Benchmark order creation version transition conflicted.",
        );
      }
      await transaction.orderPayment.create({
        data: {
          orderId,
          provider: "PHASE_08_PENDING",
          method: "MANUAL_REVIEW",
          amountRials: priceRials,
          status: "UNPAID",
          idempotencyKey: `benchmark:write:payment:${orderId}`,
          createdAt: now,
          updatedAt: now,
        },
      });
      await transaction.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: "DRAFT",
          toStatus: "PENDING_CONFIRMATION",
          actorId: ORDER_E2E_ACTORS.ORDER_MANAGER.id,
          actorType: "ADMIN",
          requestId: `benchmark:write:create:${orderId}`,
          version: 2,
          createdAt: now,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: ORDER_E2E_ACTORS.ORDER_MANAGER.id,
          actorType: "ADMIN",
          action: "order.created",
          entityType: "Order",
          entityId: orderId,
          requestId: `benchmark:write:create:${orderId}`,
          metadata: {
            benchmark: "phase07-order",
            orderNumber,
            status: "PENDING_CONFIRMATION",
            version: 2,
          },
          afterSnapshot: { allocationStatus: "ALLOCATED", itemCount: 1 },
          createdAt: now,
        },
      });
      await transaction.orderOutboxEvent.createMany({
        data: [
          {
            orderId,
            eventType: "order.created",
            aggregateVersion: 2,
            schemaVersion: 1,
            payload: {
              benchmark: "phase07-order",
              orderNumber,
              status: "PENDING_CONFIRMATION",
              allocationStatus: "ALLOCATED",
            },
            occurredAt: now,
            status: "PENDING",
            availableAt: now,
            attempts: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            orderId,
            eventType: "order.inventory_reserved",
            aggregateVersion: 2,
            schemaVersion: 1,
            payload: {
              benchmark: "phase07-order",
              orderNumber,
              status: "PENDING_CONFIRMATION",
              allocationStatus: "ALLOCATED",
            },
            occurredAt: now,
            status: "PENDING",
            availableAt: now,
            attempts: 0,
            createdAt: now,
            updatedAt: now,
          },
        ],
      });
      await transaction.orderIdempotencyRecord.create({
        data: {
          scope: `benchmark:order:create:${reference.customerId}`,
          key: `benchmark:write:create:${orderId}`,
          requestHash: `benchmark-write-create-${orderId}`,
          responseReference: orderNumber,
          orderId,
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1_000),
          createdAt: now,
          updatedAt: now,
        },
      });

      return { id: orderId, orderNumber, reservationId, expectedVersion: 2 };
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}

async function confirmOrderPersistenceSample(prisma, context, action) {
  const now = new Date();
  return prisma.$transaction(
    async (transaction) => {
      const current = await transaction.order.findUnique({
        where: { id: action.id },
        select: {
          id: true,
          orderNumber: true,
          version: true,
          orderStatus: true,
          allocationStatus: true,
        },
      });
      if (
        !current ||
        current.version !== action.expectedVersion ||
        current.orderStatus !== "PENDING_CONFIRMATION"
      ) {
        throw new Error("Benchmark confirmation target is not eligible.");
      }
      const transitioned = await transaction.order.updateMany({
        where: {
          id: current.id,
          version: action.expectedVersion,
          orderStatus: "PENDING_CONFIRMATION",
        },
        data: { orderStatus: "CONFIRMED", version: { increment: 1 } },
      });
      if (transitioned.count !== 1) {
        throw new Error(
          "Benchmark confirmation version transition conflicted.",
        );
      }
      const extended = await transaction.inventoryReservation.updateMany({
        where: { id: action.reservationId, status: "ACTIVE" },
        data: { expiresAt: new Date(now.getTime() + 72 * 60 * 60 * 1_000) },
      });
      if (extended.count !== 1) {
        throw new Error("Benchmark confirmation reservation is not active.");
      }
      await transaction.orderStatusHistory.create({
        data: {
          orderId: current.id,
          fromStatus: "PENDING_CONFIRMATION",
          toStatus: "CONFIRMED",
          actorId: ORDER_E2E_ACTORS.ORDER_MANAGER.id,
          actorType: "ADMIN",
          requestId: `benchmark:write:confirm:${current.id}`,
          version: action.expectedVersion + 1,
          createdAt: now,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: ORDER_E2E_ACTORS.ORDER_MANAGER.id,
          actorType: "ADMIN",
          action: "order.confirmed",
          entityType: "Order",
          entityId: current.id,
          requestId: `benchmark:write:confirm:${current.id}`,
          metadata: {
            benchmark: "phase07-order",
            orderNumber: current.orderNumber,
            status: "CONFIRMED",
            version: action.expectedVersion + 1,
          },
          beforeSnapshot: { status: "PENDING_CONFIRMATION" },
          afterSnapshot: { status: "CONFIRMED" },
          createdAt: now,
        },
      });
      await transaction.orderOutboxEvent.create({
        data: {
          orderId: current.id,
          eventType: "order.confirmed",
          aggregateVersion: action.expectedVersion + 1,
          schemaVersion: 1,
          payload: {
            benchmark: "phase07-order",
            orderNumber: current.orderNumber,
            status: "CONFIRMED",
            allocationStatus: current.allocationStatus,
          },
          occurredAt: now,
          status: "PENDING",
          availableAt: now,
          attempts: 0,
          createdAt: now,
          updatedAt: now,
        },
      });
      await transaction.orderIdempotencyRecord.create({
        data: {
          scope: `benchmark:order:${current.id}:confirm`,
          key: `benchmark:write:confirm:${current.id}`,
          requestHash: `benchmark-write-confirm-${current.id}`,
          responseReference: current.orderNumber,
          orderId: current.id,
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1_000),
          createdAt: now,
          updatedAt: now,
        },
      });
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}

async function explain(prisma, sql, values) {
  const rows = await prisma.$queryRawUnsafe(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
    ...values,
  );
  const document = rows[0]?.["QUERY PLAN"];
  const parsed = typeof document === "string" ? JSON.parse(document) : document;
  const report = Array.isArray(parsed) ? parsed[0] : parsed;
  return {
    planningMs: Number(report?.["Planning Time"] ?? 0),
    executionMs: Number(report?.["Execution Time"] ?? 0),
    rootNode: report?.Plan?.["Node Type"] ?? "unknown",
  };
}

async function sqlSamples(prisma, sql, values, count) {
  return timeSamples(() => prisma.$queryRawUnsafe(sql, ...values), count);
}

export function findOrderBenchmarkP95Failures(
  metrics,
  targets = ORDER_BENCHMARK_P95_TARGETS_MS,
) {
  return Object.entries(targets).flatMap(([name, targetMs]) => {
    const metric = metrics?.[name];
    if (!metric || !Number.isFinite(metric.p95Ms)) {
      return [{ name, targetMs, actualMs: null, reason: "missing_metric" }];
    }
    if (metric.p95Ms > targetMs) {
      return [
        { name, targetMs, actualMs: metric.p95Ms, reason: "p95_exceeded" },
      ];
    }
    return [];
  });
}

export function createOrderBenchmarkReport({
  scale,
  marker,
  samples,
  seedDurationMs,
  distribution,
  metrics,
  sqlMetrics,
  plans,
  actionOperations,
}) {
  const failures = findOrderBenchmarkP95Failures(metrics);
  return {
    schemaVersion: 2,
    phase: "07",
    generatedAt: new Date().toISOString(),
    dataset: {
      size: scale,
      marker,
      distribution,
    },
    measurement: {
      samples,
      seedDurationMs,
      scope:
        "Isolated PostgreSQL persistence benchmark. Read metrics exercise the ORM query shapes; write metrics exercise the transactional durable write shape for create and confirm, excluding external payment and HTTP transport.",
      actionOperations,
    },
    targetsMs: ORDER_BENCHMARK_P95_TARGETS_MS,
    metrics,
    sql: {
      p95Metrics: sqlMetrics,
      plans,
    },
    failures,
    passed: failures.length === 0,
  };
}

export async function executeOrderBenchmark(scale) {
  const validation = validateOrderBenchmarkEnvironment(process.env);
  if (!validation.ok) {
    throw new Error(
      `Order benchmark preflight failed: ${validation.errors.join(" ")}`,
    );
  }
  const options = optionsFromEnvironment();
  const context = benchmarkContext(options.runId);
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.ORDER_TEST_DATABASE_URL } },
  });
  try {
    await assertMigratedSeed(prisma);
    await assertUnusedRun(prisma, context);
    const distribution = await seedBenchmarkReferences(
      prisma,
      context,
      scale,
      options.samples + 1,
    );
    const seedDurationMs = await seedScale(
      prisma,
      context,
      scale,
      options.batchSize,
    );
    await prisma.$executeRaw`ANALYZE "Order", "OrderItem", "OrderAllocation", "OrderPayment", "OrderFulfillment", "OrderStatusHistory", "OrderIdempotencyRecord", "OrderOutboxEvent", "InventoryReservation"`;

    const probeOrdinal = Math.max(1, Math.floor(scale / 2));
    const probeOrderNumber = context.orderNumber(probeOrdinal);
    const probeCustomerId = context.customerId(1);
    const probeBranchId = context.branchId(1);
    const sqlQueries = ORDER_BENCHMARK_SQL_QUERIES;
    const metrics = {
      adminOrderList: await timeSamples(
        () =>
          prisma.order.findMany({
            where: { orderStatus: "CONFIRMED" },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 25,
            select: {
              id: true,
              orderNumber: true,
              paymentStatus: true,
              fulfillmentStatus: true,
              createdAt: true,
            },
          }),
        options.samples,
      ),
      customerOrderList: await timeSamples(
        () =>
          prisma.order.findMany({
            where: { customerId: probeCustomerId },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 25,
            select: {
              id: true,
              orderNumber: true,
              orderStatus: true,
              createdAt: true,
            },
          }),
        options.samples,
      ),
      branchOrderList: await timeSamples(
        () =>
          prisma.order.findMany({
            where: { allocations: { some: { branchId: probeBranchId } } },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 25,
            select: { id: true, orderNumber: true, createdAt: true },
          }),
        options.samples,
      ),
      orderDetail: await timeSamples(
        () =>
          prisma.order.findUniqueOrThrow({
            where: { orderNumber: probeOrderNumber },
            select: {
              id: true,
              orderNumber: true,
              items: { select: { id: true, sku: true, lineTotalRials: true } },
              allocations: {
                select: { id: true, status: true, reservationId: true },
              },
              payments: { select: { id: true, status: true } },
              statusHistory: { select: { id: true, toStatus: true } },
              fulfillment: { select: { id: true, status: true } },
            },
          }),
        options.samples,
      ),
      orderNumberSearch: await timeSamples(
        () =>
          prisma.order.findFirst({
            where: { orderNumber: probeOrderNumber },
            select: { id: true, orderNumber: true },
          }),
        options.samples,
      ),
    };
    const actions = [];
    metrics.createOrder = await timeSamples(async () => {
      const ordinal = actions.length + 1;
      actions.push(
        await createOrderPersistenceSample(prisma, context, ordinal),
      );
    }, options.samples);
    let confirmationIndex = 0;
    metrics.confirmOrder = await timeSamples(async () => {
      const action = actions[confirmationIndex];
      confirmationIndex += 1;
      if (!action) throw new Error("Benchmark confirmation sample is missing.");
      await confirmOrderPersistenceSample(prisma, context, action);
    }, options.samples);

    const sqlMetrics = {
      adminOrderList: await sqlSamples(
        prisma,
        sqlQueries.adminOrderList,
        ["CONFIRMED"],
        options.samples,
      ),
      customerOrderList: await sqlSamples(
        prisma,
        sqlQueries.customerOrderList,
        [probeCustomerId],
        options.samples,
      ),
      branchOrderList: await sqlSamples(
        prisma,
        sqlQueries.branchOrderList,
        [probeBranchId],
        options.samples,
      ),
      orderNumberSearch: await sqlSamples(
        prisma,
        sqlQueries.orderNumberSearch,
        [probeOrderNumber],
        options.samples,
      ),
    };
    const plans = {
      adminOrderList: await explain(prisma, sqlQueries.adminOrderList, [
        "CONFIRMED",
      ]),
      customerOrderList: await explain(prisma, sqlQueries.customerOrderList, [
        probeCustomerId,
      ]),
      branchOrderList: await explain(prisma, sqlQueries.branchOrderList, [
        probeBranchId,
      ]),
      orderNumberSearch: await explain(prisma, sqlQueries.orderNumberSearch, [
        probeOrderNumber,
      ]),
    };
    const evidence = createOrderBenchmarkReport({
      scale,
      marker: context.marker,
      samples: options.samples,
      seedDurationMs,
      distribution,
      metrics,
      sqlMetrics,
      plans,
      actionOperations: {
        createOrder: actions.length,
        confirmOrder: confirmationIndex,
        warmupsPerOperation: 1,
      },
    });
    console.log(JSON.stringify(evidence, null, 2));
    if (!evidence.passed) {
      throw new Error(
        `Order benchmark p95 target failed for: ${evidence.failures.map((failure) => failure.name).join(", ")}.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

function usage() {
  console.log(`Phase 07 guarded order benchmark

Usage:
  pnpm order:benchmark -- --execute --scale 10000
  pnpm order:benchmark -- --execute --scale 100000

Required environment: NODE_ENV=test, APPLE333_TEST_DB=1,
APPLE333_ORDER_TEST_DB=1, an owned loopback ORDER_TEST_DATABASE_URL,
ORDER_BENCHMARK_ALLOW_SEED=1, and a new ORDER_BENCHMARK_RUN_ID.

The command refuses non-test-like targets, never removes existing benchmark
evidence, and requires deterministic fixtures from pnpm order:test:seed. It
records ORM and raw-SQL p95 reads plus transactional create/confirm persistence
p95 values; external payment and HTTP transport are intentionally excluded.`);
}

async function main() {
  try {
    const argumentsValue = parseOrderBenchmarkArguments();
    if (argumentsValue.help) usage();
    else await executeOrderBenchmark(argumentsValue.scale);
  } catch (error) {
    console.error(
      sanitizeE2eLog(
        error instanceof Error ? error.message : "Order benchmark failed.",
      ),
    );
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  void main();
}
