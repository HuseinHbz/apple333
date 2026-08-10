import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@prisma/client";

import {
  ORDER_E2E_ACTORS,
  ORDER_E2E_FIXTURES,
} from "../../scripts/order-e2e-fixtures.mjs";
import { seedOrderTestFixtures } from "../../scripts/seed-e2e-orders.mjs";
import { validateOrderTestEnvironment } from "../../scripts/verify-order-test-environment.mjs";
import { orderRepository } from "@/server/repositories/order-repository";
import type { Permission, SessionActor } from "@/server/security/permissions";
import {
  addOrderNote,
  cancelOrder,
  confirmOrder,
  createAdminOrder,
} from "@/server/services/order-service";

const preflight = validateOrderTestEnvironment(process.env);
const orderTestDatabaseUrl = process.env.ORDER_TEST_DATABASE_URL;
if (!preflight.ok || !orderTestDatabaseUrl) {
  throw new Error(
    `Order database tests require the guarded isolated target: ${preflight.errors.join(" ")}`,
  );
}

process.env.DATABASE_URL = orderTestDatabaseUrl;

const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
const orderNumberPrefix = `A33-DB-${suffix}`;
const idempotencyScopePrefix = `phase07-db-persistence-${suffix}`;
const preserveEvidence = process.env.APPLE333_ORDER_PRESERVE_EVIDENCE === "1";
let prisma: PrismaClient;
const orderIds: string[] = [];
const orderNumbers: string[] = [];

const orderManager: SessionActor = {
  id: ORDER_E2E_ACTORS.ORDER_MANAGER.id,
  isAdmin: true,
  roleCodes: ["ORDER_MANAGER"],
  permissions: new Set<Permission>([
    "orders.read",
    "orders.create_admin",
    "orders.cancel",
    "orders.confirm",
    "orders.view_financials",
    "orders.view_customer_pii",
    "orders.view_imei",
    "orders.audit.read",
    "orders.add_internal_note",
  ]),
};

function auditContext(operation: string) {
  return {
    requestId: `phase07-db-${operation}-${suffix}`,
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

function orderData(orderNumber: string) {
  return {
    orderNumber,
    source: "ADMIN" as const,
    type: "STANDARD_SALE" as const,
    customerSnapshot: { name: "Phase 07 isolated database fixture" },
    currency: "IRR",
    subtotalRials: 100_000n,
    discountTotalRials: 0n,
    taxTotalRials: 0n,
    shippingTotalRials: 0n,
    feeTotalRials: 0n,
    grandTotalRials: 100_000n,
    fulfillmentMethod: "PICKUP" as const,
  };
}

async function readDurableOrderSnapshot(client: PrismaClient, orderId: string) {
  return client.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      orderStatus: true,
      allocationStatus: true,
      customerSnapshot: true,
      currency: true,
      subtotalRials: true,
      grandTotalRials: true,
      version: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          sku: true,
          productName: true,
          variantName: true,
          quantity: true,
          unitPriceRials: true,
          lineTotalRials: true,
          attributesSnapshot: true,
        },
      },
      allocations: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          branchId: true,
          inventoryItemId: true,
          quantity: true,
          status: true,
          reservation: {
            select: { id: true, status: true, quantity: true },
          },
        },
      },
      payments: {
        orderBy: { id: "asc" },
        select: { provider: true, status: true, amountRials: true },
      },
      statusHistory: {
        orderBy: { id: "asc" },
        select: { fromStatus: true, toStatus: true, version: true },
      },
      idempotencyRecords: {
        orderBy: { id: "asc" },
        select: {
          scope: true,
          key: true,
          requestHash: true,
          responseReference: true,
          orderId: true,
        },
      },
      outboxEvents: {
        orderBy: { id: "asc" },
        select: { eventType: true, aggregateVersion: true, payload: true },
      },
    },
  });
}

describe.sequential(
  "Phase 07 real PostgreSQL order persistence skeleton",
  () => {
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
          where: { scope: { startsWith: idempotencyScopePrefix } },
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
      }
      await prisma.$disconnect();
    });

    it("has the completed Phase 07 migration and all core order tables", async () => {
      const migration = await prisma.$queryRaw<
        readonly Readonly<{
          name: string;
          finishedAt: Date | null;
          rolledBackAt: Date | null;
        }>[]
      >`
      SELECT migration_name AS name, finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt"
      FROM "_prisma_migrations"
      WHERE migration_name = '20260729000000_phase_07_order_management'
    `;
      expect(migration).toEqual([
        expect.objectContaining({
          name: "20260729000000_phase_07_order_management",
          finishedAt: expect.any(Date),
          rolledBackAt: null,
        }),
      ]);

      const tables = await prisma.$queryRaw<
        readonly Readonly<{ name: string | null }>[]
      >`
      SELECT to_regclass('public."Order"')::text AS name
      UNION ALL SELECT to_regclass('public."OrderItem"')::text
      UNION ALL SELECT to_regclass('public."OrderAllocation"')::text
      UNION ALL SELECT to_regclass('public."OrderPayment"')::text
      UNION ALL SELECT to_regclass('public."OrderFulfillment"')::text
      UNION ALL SELECT to_regclass('public."OrderStatusHistory"')::text
      UNION ALL SELECT to_regclass('public."OrderDeviceAssignment"')::text
      UNION ALL SELECT to_regclass('public."OrderIdempotencyRecord"')::text
      UNION ALL SELECT to_regclass('public."OrderOutboxEvent"')::text
    `;
      expect(tables.map((entry) => entry.name)).not.toContain(null);

      const requiredIndexes = await prisma.$queryRaw<
        readonly Readonly<{ name: string | null }>[]
      >`
      SELECT to_regclass('public."Order_createdAt_idx"')::text AS name
      UNION ALL SELECT to_regclass('public."OrderDeviceAssignment_active_device_unit_key"')::text
    `;
      expect(requiredIndexes.map((entry) => entry.name)).toEqual([
        '"Order_createdAt_idx"',
        '"OrderDeviceAssignment_active_device_unit_key"',
      ]);
    });

    it("persists an immutable commercial snapshot and its server-calculated total", async () => {
      const created = await prisma.order.create({
        data: orderData(`${orderNumberPrefix}-PERSIST`),
        select: {
          id: true,
          orderNumber: true,
          customerSnapshot: true,
          subtotalRials: true,
          grandTotalRials: true,
          version: true,
        },
      });
      orderIds.push(created.id);

      const reloaded = await prisma.order.findUniqueOrThrow({
        where: { id: created.id },
        select: {
          orderNumber: true,
          customerSnapshot: true,
          subtotalRials: true,
          grandTotalRials: true,
          version: true,
        },
      });

      expect(reloaded).toEqual({
        orderNumber: `${orderNumberPrefix}-PERSIST`,
        customerSnapshot: { name: "Phase 07 isolated database fixture" },
        subtotalRials: 100_000n,
        grandTotalRials: 100_000n,
        version: 1,
      });
    });

    it("enforces non-negative and balanced persisted order money", async () => {
      await expect(
        prisma.order.create({
          data: {
            ...orderData(`${orderNumberPrefix}-INVALID-TOTAL`),
            grandTotalRials: 99_999n,
          },
        }),
      ).rejects.toBeDefined();
    });

    it("keeps the commercial order-item snapshot immutable after catalog data changes", async () => {
      const created = await createAdminOrder(
        orderManager,
        adminOrderInput(`phase07-db-catalog-snapshot-${suffix}`),
        auditContext("catalog-snapshot-create"),
      );
      orderIds.push(created.id);
      orderNumbers.push(created.orderNumber);

      try {
        const beforeMutation = await prisma.orderItem.findFirstOrThrow({
          where: { orderId: created.id },
          select: {
            productName: true,
            variantName: true,
            sku: true,
            unitPriceRials: true,
            lineTotalRials: true,
            attributesSnapshot: true,
          },
        });

        await prisma.catalogProduct.update({
          where: { id: ORDER_E2E_FIXTURES.product.id },
          data: { name: `Mutated catalog product ${suffix}` },
        });
        await prisma.catalogVariant.update({
          where: { id: ORDER_E2E_FIXTURES.variant.id },
          data: {
            title: `Mutated catalog variant ${suffix}`,
            attributes: { color: "Purple", storage: "1TB", mutated: true },
            priceRials: 2_999_000_000n,
          },
        });

        const historical = await prisma.orderItem.findFirstOrThrow({
          where: { orderId: created.id },
          select: {
            productName: true,
            variantName: true,
            sku: true,
            unitPriceRials: true,
            lineTotalRials: true,
            attributesSnapshot: true,
          },
        });

        expect(historical).toEqual(beforeMutation);
        expect(historical).toEqual({
          productName: ORDER_E2E_FIXTURES.product.name,
          variantName: ORDER_E2E_FIXTURES.variant.title,
          sku: ORDER_E2E_FIXTURES.variant.sku,
          unitPriceRials: ORDER_E2E_FIXTURES.variant.priceRials,
          lineTotalRials: ORDER_E2E_FIXTURES.variant.priceRials,
          attributesSnapshot: { color: "Black", storage: "256GB" },
        });
      } finally {
        await prisma.catalogProduct.update({
          where: { id: ORDER_E2E_FIXTURES.product.id },
          data: { name: ORDER_E2E_FIXTURES.product.name },
        });
        await prisma.catalogVariant.update({
          where: { id: ORDER_E2E_FIXTURES.variant.id },
          data: {
            title: ORDER_E2E_FIXTURES.variant.title,
            attributes: { color: "Black", storage: "256GB" },
            priceRials: ORDER_E2E_FIXTURES.variant.priceRials,
          },
        });
        await cancelOrder(
          orderManager,
          created.id,
          {
            expectedVersion: created.version,
            reasonCode: "CATALOG_SNAPSHOT_TEST_CLEANUP",
            idempotencyKey: `phase07-db-catalog-snapshot-cancel-${suffix}`,
          },
          auditContext("catalog-snapshot-cancel"),
        );
      }
    });

    it("retains the complete order aggregate after a Prisma client disconnect and reconnect", async () => {
      const created = await createAdminOrder(
        orderManager,
        adminOrderInput(`phase07-db-reconnect-${suffix}`),
        auditContext("reconnect-create"),
      );
      orderIds.push(created.id);
      orderNumbers.push(created.orderNumber);

      const firstReader = new PrismaClient({
        datasources: { db: { url: orderTestDatabaseUrl } },
      });
      let restartedReader: PrismaClient | null = null;
      try {
        await firstReader.$connect();
        const beforeDisconnect = await readDurableOrderSnapshot(
          firstReader,
          created.id,
        );
        await firstReader.$disconnect();

        restartedReader = new PrismaClient({
          datasources: { db: { url: orderTestDatabaseUrl } },
        });
        await restartedReader.$connect();
        const afterReconnect = await readDurableOrderSnapshot(
          restartedReader,
          created.id,
        );

        expect(afterReconnect).toEqual(beforeDisconnect);
      } finally {
        await firstReader.$disconnect();
        await restartedReader?.$disconnect();
        await cancelOrder(
          orderManager,
          created.id,
          {
            expectedVersion: created.version,
            reasonCode: "PRISMA_RECONNECT_TEST_CLEANUP",
            idempotencyKey: `phase07-db-reconnect-cancel-${suffix}`,
          },
          auditContext("reconnect-cancel"),
        );
      }
    });

    it("persists exactly one internal note for an idempotent replay and rejects a changed note payload", async () => {
      const created = await createAdminOrder(
        orderManager,
        adminOrderInput(`phase07-db-note-${suffix}`),
        auditContext("note-create"),
      );
      orderIds.push(created.id);
      orderNumbers.push(created.orderNumber);
      const idempotencyKey = `phase07-db-note-key-${suffix}`;
      const noteInput = {
        visibility: "INTERNAL" as const,
        content: `Internal idempotency evidence ${suffix}`,
        idempotencyKey,
      };

      try {
        const first = await addOrderNote(
          orderManager,
          created.id,
          noteInput,
          auditContext("note-first"),
        );
        const replay = await addOrderNote(
          orderManager,
          created.id,
          noteInput,
          auditContext("note-replay"),
        );

        expect(
          first.notes.filter((note) => note.content === noteInput.content),
        ).toHaveLength(1);
        expect(
          replay.notes.filter((note) => note.content === noteInput.content),
        ).toHaveLength(1);
        await expect(
          prisma.orderNote.count({
            where: {
              orderId: created.id,
              authorId: orderManager.id,
              visibility: "INTERNAL",
              content: noteInput.content,
            },
          }),
        ).resolves.toBe(1);
        await expect(
          prisma.orderIdempotencyRecord.count({
            where: {
              scope: `order:${created.id}:note:${orderManager.id}`,
              key: idempotencyKey,
              orderId: created.id,
            },
          }),
        ).resolves.toBe(1);

        await expect(
          addOrderNote(
            orderManager,
            created.id,
            {
              ...noteInput,
              content: `Changed internal idempotency evidence ${suffix}`,
            },
            auditContext("note-conflict"),
          ),
        ).rejects.toMatchObject({
          code: "ORDER_IDEMPOTENCY_CONFLICT",
          status: 409,
        });
        await expect(
          prisma.orderNote.count({ where: { orderId: created.id } }),
        ).resolves.toBe(1);
      } finally {
        await cancelOrder(
          orderManager,
          created.id,
          {
            expectedVersion: created.version,
            reasonCode: "ORDER_NOTE_IDEMPOTENCY_TEST_CLEANUP",
            idempotencyKey: `phase07-db-note-cancel-${suffix}`,
          },
          auditContext("note-cancel"),
        );
      }
    });

    it("scopes customer detail reads by customerId in the PostgreSQL query", async () => {
      const created = await createAdminOrder(
        orderManager,
        adminOrderInput(`phase07-db-customer-scope-${suffix}`),
        auditContext("customer-scope-create"),
      );
      orderIds.push(created.id);
      orderNumbers.push(created.orderNumber);

      try {
        const [ownedOrder, otherCustomersResult] = await Promise.all([
          orderRepository.findOrderForCustomerByNumber(
            created.orderNumber,
            ORDER_E2E_ACTORS.CUSTOMER.id,
          ),
          orderRepository.findOrderForCustomerByNumber(
            created.orderNumber,
            ORDER_E2E_ACTORS.CUSTOMER_OTHER.id,
          ),
        ]);

        expect(ownedOrder).toMatchObject({
          id: created.id,
          customerId: ORDER_E2E_ACTORS.CUSTOMER.id,
        });
        expect(otherCustomersResult).toBeNull();
      } finally {
        await cancelOrder(
          orderManager,
          created.id,
          {
            expectedVersion: created.version,
            reasonCode: "CUSTOMER_QUERY_SCOPE_TEST_CLEANUP",
            idempotencyKey: `phase07-db-customer-scope-cancel-${suffix}`,
          },
          auditContext("customer-scope-cancel"),
        );
      }
    });

    it("persists a server-authoritative order, snapshots, reservation, audit, outbox, and idempotent replay in one OMS flow", async () => {
      const input = adminOrderInput(`phase07-db-create-${suffix}`);
      const created = await createAdminOrder(
        orderManager,
        input,
        auditContext("create"),
      );
      orderIds.push(created.id);
      orderNumbers.push(created.orderNumber);

      expect(created).toMatchObject({
        status: "PENDING_CONFIRMATION",
        allocationStatus: "ALLOCATED",
        pricing: {
          grandTotalRials: ORDER_E2E_FIXTURES.variant.priceRials.toString(),
        },
      });
      expect(created.items[0]).toMatchObject({
        snapshot: {
          variantId: ORDER_E2E_FIXTURES.variant.id,
          sku: ORDER_E2E_FIXTURES.variant.sku,
        },
        lineTotalRials: ORDER_E2E_FIXTURES.variant.priceRials.toString(),
      });

      const replay = await createAdminOrder(
        orderManager,
        input,
        auditContext("create-replay"),
      );
      expect(replay.id).toBe(created.id);

      const persisted = await prisma.order.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          items: true,
          allocations: { include: { reservation: true } },
          payments: true,
          statusHistory: true,
          outboxEvents: true,
        },
      });
      expect(persisted.items).toHaveLength(1);
      expect(persisted.allocations).toHaveLength(1);
      expect(persisted.allocations[0]?.reservation).toMatchObject({
        status: "ACTIVE",
        quantity: 1,
      });
      expect(persisted.payments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            provider: "PHASE_08_PENDING",
            status: "UNPAID",
          }),
        ]),
      );
      expect(persisted.statusHistory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fromStatus: "DRAFT",
            toStatus: "PENDING_CONFIRMATION",
          }),
        ]),
      );
      expect(persisted.outboxEvents.map((event) => event.eventType)).toEqual(
        expect.arrayContaining(["order.created", "order.inventory_reserved"]),
      );
      await expect(
        prisma.auditLog.findMany({
          where: { entityId: created.id, action: "order.created" },
          select: { action: true, requestId: true, afterSnapshot: true },
        }),
      ).resolves.toEqual([
        expect.objectContaining({
          action: "order.created",
          requestId: auditContext("create").requestId,
        }),
      ]);

      const cancelled = await cancelOrder(
        orderManager,
        created.id,
        {
          expectedVersion: created.version,
          reasonCode: "DB_PERSISTENCE_CANCEL",
          idempotencyKey: `phase07-db-cancel-${suffix}`,
        },
        auditContext("cancel"),
      );
      expect(cancelled).toMatchObject({
        status: "CANCELLED",
        allocationStatus: "RELEASED",
      });
      await expect(
        prisma.inventoryReservation.findFirstOrThrow({
          where: { reference: { contains: created.orderNumber } },
          select: { status: true },
        }),
      ).resolves.toEqual({ status: "RELEASED" });

      await expect(
        confirmOrder(
          orderManager,
          created.id,
          {
            expectedVersion: cancelled.version,
            idempotencyKey: `phase07-db-invalid-confirm-${suffix}`,
          },
          auditContext("invalid-confirm"),
        ),
      ).rejects.toMatchObject({
        code: "ORDER_INVALID_TRANSITION",
        status: 409,
      });
      await expect(
        prisma.auditLog.findMany({
          where: { entityId: created.id, action: "order.transition.rejected" },
          select: { action: true, reasonCode: true, requestId: true },
        }),
      ).resolves.toEqual([
        expect.objectContaining({
          action: "order.transition.rejected",
          reasonCode: "INVALID_TRANSITION",
          requestId: auditContext("invalid-confirm").requestId,
        }),
      ]);
    });

    it("rejects a customer-owned cancellation at the service boundary when orders.read_own is missing", async () => {
      const input = adminOrderInput(`phase07-db-owned-${suffix}`);
      const created = await createAdminOrder(
        orderManager,
        input,
        auditContext("owned-create"),
      );
      orderIds.push(created.id);
      orderNumbers.push(created.orderNumber);
      const unprivilegedCustomer: SessionActor = {
        id: ORDER_E2E_ACTORS.CUSTOMER.id,
        isAdmin: false,
        roleCodes: ["CUSTOMER"],
        permissions: new Set<Permission>(),
      };

      await expect(
        cancelOrder(
          unprivilegedCustomer,
          created.id,
          {
            expectedVersion: created.version,
            reasonCode: "CUSTOMER_REQUEST",
            idempotencyKey: `phase07-db-owned-cancel-${suffix}`,
          },
          auditContext("owned-cancel"),
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        prisma.order.findUniqueOrThrow({
          where: { id: created.id },
          select: { orderStatus: true },
        }),
      ).resolves.toEqual({ orderStatus: "PENDING_CONFIRMATION" });

      await cancelOrder(
        orderManager,
        created.id,
        {
          expectedVersion: created.version,
          reasonCode: "DB_CLEANUP_CANCEL",
          idempotencyKey: `phase07-db-owned-cleanup-${suffix}`,
        },
        auditContext("owned-cleanup"),
      );
    });

    it("rejects a branch-scoped delivery allocation before it creates an order or a reservation in another branch", async () => {
      const branchScopedActor: SessionActor = {
        id: ORDER_E2E_ACTORS.ORDER_MANAGER.id,
        isAdmin: true,
        roleCodes: ["BRANCH_OPERATOR"],
        branchId: "phase07-unauthorized-branch",
        permissions: new Set<Permission>(["orders.create_admin"]),
      };
      const before = await Promise.all([
        prisma.order.count(),
        prisma.inventoryReservation.count(),
      ]);

      await expect(
        createAdminOrder(
          branchScopedActor,
          {
            ...adminOrderInput(`phase07-db-cross-branch-${suffix}`),
            fulfillmentMethod: "DELIVERY",
            shippingAddressId: ORDER_E2E_FIXTURES.customerAddress.id,
            pickupBranchId: undefined,
          },
          auditContext("cross-branch"),
        ),
      ).rejects.toMatchObject({ status: 403 });

      await expect(
        Promise.all([
          prisma.order.count(),
          prisma.inventoryReservation.count(),
        ]),
      ).resolves.toEqual(before);
    });
  },
);
