import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@prisma/client";

import {
  ORDER_E2E_ACTORS,
  ORDER_E2E_FIXTURES,
} from "../../scripts/order-e2e-fixtures.mjs";
import { seedOrderTestFixtures } from "../../scripts/seed-e2e-orders.mjs";
import { validateOrderTestEnvironment } from "../../scripts/verify-order-test-environment.mjs";
import type { Permission, SessionActor } from "@/server/security/permissions";
import {
  cancelOrder,
  createAdminOrder,
  type OrderDetailDto,
} from "@/server/services/order-service";

const preflight = validateOrderTestEnvironment(process.env);
const orderTestDatabaseUrl = process.env.ORDER_TEST_DATABASE_URL;
if (!preflight.ok || !orderTestDatabaseUrl) {
  throw new Error(
    `Order concurrency tests require the guarded isolated target: ${preflight.errors.join(" ")}`,
  );
}

process.env.DATABASE_URL = orderTestDatabaseUrl;

const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
const idempotencyScope = `phase07-db-concurrency-${suffix}`;
const orderNumberPrefix = `A33-CONC-${suffix}`;
const preserveEvidence = process.env.APPLE333_ORDER_PRESERVE_EVIDENCE === "1";
let prisma: PrismaClient;
const orderIds: string[] = [];
const orderNumbers: string[] = [];
let trackedFixture: Readonly<{
  variantId: string;
  skuId: string;
  inventoryItemId: string;
  deviceUnitId: string;
}> | null = null;

const orderManager: SessionActor = {
  id: ORDER_E2E_ACTORS.ORDER_MANAGER.id,
  isAdmin: true,
  roleCodes: ["ORDER_MANAGER"],
  permissions: new Set<Permission>([
    "orders.read",
    "orders.create_admin",
    "orders.cancel",
    "orders.view_financials",
    "orders.view_customer_pii",
    "orders.view_imei",
  ]),
};

function auditContext(operation: string) {
  return {
    requestId: `phase07-db-concurrency-${operation}-${suffix}`,
    ipAddress: "127.0.0.1",
    userAgent: "phase07-db-test",
  };
}

function adminOrderInput(
  idempotencyKey: string,
  variantId: string = ORDER_E2E_FIXTURES.variant.id,
) {
  return {
    customerId: ORDER_E2E_ACTORS.CUSTOMER.id,
    source: "ADMIN" as const,
    type: "STANDARD_SALE" as const,
    fulfillmentMethod: "PICKUP" as const,
    pickupBranchId: ORDER_E2E_FIXTURES.branch.id,
    items: [{ variantId, quantity: 1 }],
    idempotencyKey,
  };
}

function fulfilled(
  result: PromiseSettledResult<OrderDetailDto>,
): result is PromiseFulfilledResult<OrderDetailDto> {
  return result.status === "fulfilled";
}

function orderData(orderNumber: string) {
  return {
    orderNumber,
    source: "ADMIN" as const,
    type: "STANDARD_SALE" as const,
    customerSnapshot: { name: "Phase 07 concurrency fixture" },
    currency: "IRR",
    subtotalRials: 1n,
    discountTotalRials: 0n,
    taxTotalRials: 0n,
    shippingTotalRials: 0n,
    feeTotalRials: 0n,
    grandTotalRials: 1n,
    fulfillmentMethod: "PICKUP" as const,
  };
}

describe.sequential("Phase 07 real PostgreSQL concurrency skeleton", () => {
  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: orderTestDatabaseUrl } },
    });
    await prisma.$connect();
    await seedOrderTestFixtures(prisma);
  });

  afterAll(async () => {
    if (!preserveEvidence) {
      await prisma.orderIdempotencyRecord.deleteMany({
        where: { scope: idempotencyScope },
      });
      if (orderIds.length > 0) {
        await prisma.orderIdempotencyRecord.deleteMany({
          where: { orderId: { in: orderIds } },
        });
        await prisma.auditLog.deleteMany({
          where: { entityId: { in: orderIds } },
        });
      }
      if (orderIds.length > 0)
        await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
      for (const orderNumber of orderNumbers) {
        await prisma.inventoryReservation.deleteMany({
          where: { reference: { contains: orderNumber } },
        });
        await prisma.stockMovement.deleteMany({
          where: { reference: { contains: orderNumber } },
        });
      }
      if (trackedFixture) {
        await prisma.deviceUnit.deleteMany({
          where: { id: trackedFixture.deviceUnitId },
        });
        await prisma.branchInventory.deleteMany({
          where: {
            branchId: ORDER_E2E_FIXTURES.branch.id,
            variantId: trackedFixture.variantId,
          },
        });
        await prisma.inventoryItem.deleteMany({
          where: { id: trackedFixture.inventoryItemId },
        });
        await prisma.inventorySkuPolicy.deleteMany({
          where: { skuId: trackedFixture.skuId },
        });
        await prisma.productSku.deleteMany({
          where: { id: trackedFixture.skuId },
        });
        await prisma.catalogVariant.deleteMany({
          where: { id: trackedFixture.variantId },
        });
      }
    }
    await prisma.$disconnect();
  });

  it("allows exactly one concurrent idempotency record for the same scope and key", async () => {
    const key = "duplicate-operation-key";
    const attempts = await Promise.allSettled([
      prisma.orderIdempotencyRecord.create({
        data: {
          scope: idempotencyScope,
          key,
          requestHash: "a".repeat(64),
          responseReference: "A33-CONC-ONE",
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
      prisma.orderIdempotencyRecord.create({
        data: {
          scope: idempotencyScope,
          key,
          requestHash: "a".repeat(64),
          responseReference: "A33-CONC-ONE",
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ]);

    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === "rejected"),
    ).toHaveLength(1);
    await expect(
      prisma.orderIdempotencyRecord.count({
        where: { scope: idempotencyScope, key },
      }),
    ).resolves.toBe(1);
  });

  it("replays one durable OMS create when identical idempotent creates arrive concurrently", async () => {
    const idempotencyKey = `phase07-duplicate-service-create-${suffix}`;
    const input = adminOrderInput(idempotencyKey);
    const attempts = await Promise.allSettled([
      createAdminOrder(
        orderManager,
        input,
        auditContext("duplicate-service-create-a"),
      ),
      createAdminOrder(
        orderManager,
        input,
        auditContext("duplicate-service-create-b"),
      ),
    ]);
    const successes = attempts.filter(fulfilled);

    expect(successes).toHaveLength(2);
    const orderIdsFromAttempts = [
      ...new Set(successes.map((attempt) => attempt.value.id)),
    ];
    expect(orderIdsFromAttempts).toHaveLength(1);
    const orderNumber = successes[0]!.value.orderNumber;
    const orderId = orderIdsFromAttempts[0]!;
    orderIds.push(orderId);
    orderNumbers.push(orderNumber);

    await expect(prisma.order.count({ where: { id: orderId } })).resolves.toBe(
      1,
    );
    await expect(
      prisma.orderIdempotencyRecord.count({
        where: {
          scope: `order:create:admin:${orderManager.id}`,
          key: idempotencyKey,
          orderId,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.inventoryReservation.count({
        where: { reference: { contains: orderNumber }, status: "ACTIVE" },
      }),
    ).resolves.toBe(1);

    await expect(
      cancelOrder(
        orderManager,
        orderId,
        {
          expectedVersion: successes[0]!.value.version,
          reasonCode: "DUPLICATE_CREATE_TEST_CLEANUP",
          idempotencyKey: `phase07-duplicate-service-create-cancel-${suffix}`,
        },
        auditContext("duplicate-service-create-cancel"),
      ),
    ).resolves.toMatchObject({
      id: orderId,
      status: "CANCELLED",
      allocationStatus: "RELEASED",
    });
  });

  it("makes a stale optimistic-version mutation a no-op", async () => {
    const order = await prisma.order.create({
      data: orderData(`${orderNumberPrefix}-VERSION`),
      select: { id: true },
    });
    orderIds.push(order.id);

    const updates = await Promise.all([
      prisma.order.updateMany({
        where: { id: order.id, version: 1 },
        data: { version: { increment: 1 } },
      }),
      prisma.order.updateMany({
        where: { id: order.id, version: 1 },
        data: { version: { increment: 1 } },
      }),
    ]);

    expect(updates.map((update) => update.count).sort()).toEqual([0, 1]);
    await expect(
      prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        select: { version: true },
      }),
    ).resolves.toEqual({ version: 2 });
  });

  it("allows only one concurrent checkout to reserve the final unit and restores the unit exactly once on cancellation", async () => {
    await prisma.inventoryItem.update({
      where: { id: ORDER_E2E_FIXTURES.inventoryItem.id },
      data: {
        quantity: 1,
        reservedQuantity: 0,
        availableQuantity: 1,
        version: { increment: 1 },
      },
    });
    await prisma.branchInventory.update({
      where: {
        branchId_variantId: {
          branchId: ORDER_E2E_FIXTURES.branch.id,
          variantId: ORDER_E2E_FIXTURES.variant.id,
        },
      },
      data: { onHand: 1, reserved: 0 },
    });

    const attempts = await Promise.allSettled([
      createAdminOrder(
        orderManager,
        adminOrderInput(`phase07-final-stock-a-${suffix}`),
        auditContext("final-stock-a"),
      ),
      createAdminOrder(
        orderManager,
        adminOrderInput(`phase07-final-stock-b-${suffix}`),
        auditContext("final-stock-b"),
      ),
    ]);
    const successes = attempts.filter(fulfilled);
    expect(successes).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === "rejected"),
    ).toHaveLength(1);
    const created = successes[0]!.value;
    orderIds.push(created.id);
    orderNumbers.push(created.orderNumber);

    await expect(
      prisma.inventoryItem.findUniqueOrThrow({
        where: { id: ORDER_E2E_FIXTURES.inventoryItem.id },
        select: {
          quantity: true,
          reservedQuantity: true,
          availableQuantity: true,
        },
      }),
    ).resolves.toEqual({
      quantity: 1,
      reservedQuantity: 1,
      availableQuantity: 0,
    });
    await expect(
      prisma.inventoryReservation.count({
        where: {
          reference: { contains: created.orderNumber },
          status: "ACTIVE",
        },
      }),
    ).resolves.toBe(1);

    const cancelled = await cancelOrder(
      orderManager,
      created.id,
      {
        expectedVersion: created.version,
        reasonCode: "FINAL_STOCK_TEST_CANCEL",
        idempotencyKey: `phase07-final-stock-cancel-${suffix}`,
      },
      auditContext("final-stock-cancel"),
    );
    expect(cancelled.status).toBe("CANCELLED");
    await expect(
      prisma.inventoryItem.findUniqueOrThrow({
        where: { id: ORDER_E2E_FIXTURES.inventoryItem.id },
        select: {
          quantity: true,
          reservedQuantity: true,
          availableQuantity: true,
        },
      }),
    ).resolves.toEqual({
      quantity: 1,
      reservedQuantity: 0,
      availableQuantity: 1,
    });
  });

  it("assigns a tracked IMEI to one order only and preserves its immutable OMS assignment through release", async () => {
    const variantId = `phase07-tracked-variant-${suffix}`;
    const skuId = `phase07-tracked-sku-${suffix}`;
    const inventoryItemId = `phase07-tracked-inventory-${suffix}`;
    const deviceUnitId = `phase07-tracked-device-${suffix}`;
    const imei = `860000${suffix.slice(-8).padStart(8, "0")}`.slice(0, 14);
    trackedFixture = { variantId, skuId, inventoryItemId, deviceUnitId };

    await prisma.catalogVariant.create({
      data: {
        id: variantId,
        productId: ORDER_E2E_FIXTURES.product.id,
        sku: `E2E-TRACKED-${suffix}`,
        title: "Tracked IMEI evidence device",
        attributes: { tracking: "IMEI" },
        priceRials: 1_700_000_000n,
        isActive: true,
      },
    });
    await prisma.productSku.create({
      data: {
        id: skuId,
        variantId,
        code: `E2E-TRACKED-${suffix}`,
        priceRials: 1_700_000_000n,
        status: "ACTIVE",
      },
    });
    await prisma.inventorySkuPolicy.create({
      data: { skuId, trackingMode: "IMEI" },
    });
    await prisma.inventoryItem.create({
      data: {
        id: inventoryItemId,
        warehouseId: ORDER_E2E_FIXTURES.warehouse.id,
        locationId: ORDER_E2E_FIXTURES.location.id,
        skuId,
        quantity: 1,
        reservedQuantity: 0,
        availableQuantity: 1,
        version: 1,
      },
    });
    await prisma.branchInventory.create({
      data: {
        branchId: ORDER_E2E_FIXTURES.branch.id,
        variantId,
        onHand: 1,
        reserved: 0,
      },
    });
    await prisma.deviceUnit.create({
      data: {
        id: deviceUnitId,
        skuId,
        inventoryItemId,
        imei,
        status: "AVAILABLE",
      },
    });

    const attempts = await Promise.allSettled([
      createAdminOrder(
        orderManager,
        adminOrderInput(`phase07-imei-a-${suffix}`, variantId),
        auditContext("imei-a"),
      ),
      createAdminOrder(
        orderManager,
        adminOrderInput(`phase07-imei-b-${suffix}`, variantId),
        auditContext("imei-b"),
      ),
    ]);
    const successes = attempts.filter(fulfilled);
    expect(successes).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === "rejected"),
    ).toHaveLength(1);
    const created = successes[0]!.value;
    orderIds.push(created.id);
    orderNumbers.push(created.orderNumber);

    await expect(
      prisma.orderDeviceAssignment.findMany({
        where: { deviceUnitId },
        select: {
          orderId: true,
          status: true,
          imeiSnapshot: true,
          reservationId: true,
        },
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        orderId: created.id,
        status: "RESERVED",
        imeiSnapshot: imei,
      }),
    ]);
    await expect(
      prisma.deviceUnit.findUniqueOrThrow({
        where: { id: deviceUnitId },
        select: { status: true, reservationId: true },
      }),
    ).resolves.toEqual(expect.objectContaining({ status: "RESERVED" }));

    await cancelOrder(
      orderManager,
      created.id,
      {
        expectedVersion: created.version,
        reasonCode: "IMEI_TEST_CANCEL",
        idempotencyKey: `phase07-imei-cancel-${suffix}`,
      },
      auditContext("imei-cancel"),
    );
    await expect(
      prisma.orderDeviceAssignment.findMany({
        where: { deviceUnitId },
        select: { status: true, releasedAt: true },
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        status: "RELEASED",
        releasedAt: expect.any(Date),
      }),
    ]);
    await expect(
      prisma.deviceUnit.findUniqueOrThrow({
        where: { id: deviceUnitId },
        select: { status: true, reservationId: true },
      }),
    ).resolves.toEqual({ status: "AVAILABLE", reservationId: null });
  });
});
