import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { createRefund } from "@/server/services/payment-service";
import type { Permission, SessionActor } from "@/server/security/permissions";

const financeId = `phase08-race-finance-${randomUUID()}`;
const finance: SessionActor = {
  id: financeId,
  isAdmin: true,
  roleCodes: ["FINANCE_MANAGER"],
  permissions: new Set<Permission>([
    "payments.read",
    "payments.refund",
    "payments.reconcile",
  ]),
};

async function paymentFixture(amountRials = 1_000n) {
  const order = await prisma.order.create({
    data: {
      orderNumber: `A33-RACE-${randomUUID()}`,
      source: "API",
      type: "STANDARD_SALE",
      customerSnapshot: { name: "Concurrency Fixture" },
      currency: "IRR",
      subtotalRials: amountRials,
      grandTotalRials: amountRials,
      fulfillmentMethod: "DELIVERY",
      paymentStatus: "PAID",
      orderStatus: "CONFIRMED",
    },
  });
  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      paymentNumber: `PAY-RACE-${randomUUID()}`,
      amountRials,
      currency: "IRR",
      provider: "PAYMENT_SIMULATOR",
      status: "PAID",
      paidAt: new Date(),
    },
  });
  const suffix = payment.id.replace(/[^A-Za-z0-9]/g, "").slice(-16);
  const authority = `SIM-success-${suffix}-${amountRials}-IRR`;
  await prisma.paymentAttempt.create({
    data: {
      paymentId: payment.id,
      attemptNumber: 1,
      provider: "PAYMENT_SIMULATOR",
      amountRials,
      currency: "IRR",
      status: "PAID",
      idempotencyKey: `fixture:${randomUUID()}`,
      providerAuthority: authority,
      providerReference: `REF-RACE-${randomUUID()}`,
      completedAt: new Date(),
    },
  });
  return payment;
}

beforeAll(async () => {
  process.env.APP_URL = "http://127.0.0.1:3000";
  process.env.PAYMENT_SIMULATOR_SECRET =
    "phase08-race-simulator-secret-with-32chars";
  await prisma.user.create({
    data: { id: financeId, email: `${financeId}@example.invalid` },
  });
});

describe("Phase 08 payment database concurrency", () => {
  it("allows one canonical winner for an idempotency race", async () => {
    const payment = await paymentFixture();
    const scope = `race:${randomUUID()}`;
    const key = `key:${randomUUID()}`;
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () =>
        prisma.paymentIdempotencyRecord.create({
          data: {
            scope,
            key,
            requestHash: "a".repeat(64),
            responseReference: payment.id,
            paymentId: payment.id,
            expiresAt: new Date(Date.now() + 60_000),
          },
        }),
      ),
    );
    expect(
      results.filter((entry) => entry.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      await prisma.paymentIdempotencyRecord.count({ where: { scope, key } }),
    ).toBe(1);
  });

  it("allows one callback and one provider authority winner", async () => {
    const payment = await paymentFixture();
    const eventId = `event-${randomUUID()}`;
    const callbacks = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        prisma.paymentCallback.create({
          data: {
            provider: "PAYMENT_SIMULATOR",
            externalEventId: eventId,
            payloadHash: "b".repeat(64),
            signatureStatus: "VALID",
            paymentId: payment.id,
          },
        }),
      ),
    );
    expect(
      callbacks.filter((entry) => entry.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      await prisma.paymentCallback.count({
        where: { externalEventId: eventId },
      }),
    ).toBe(1);
  });

  it("optimistic version updates have exactly one winner", async () => {
    const payment = await paymentFixture();
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        prisma.payment.updateMany({
          where: { id: payment.id, version: payment.version },
          data: { version: { increment: 1 } },
        }),
      ),
    );
    expect(results.reduce((sum, entry) => sum + entry.count, 0)).toBe(1);
  });

  it("serializes concurrent refund limits so total cannot exceed capture", async () => {
    const payment = await paymentFixture(1_000n);
    const requests = await Promise.allSettled([
      createRefund(
        finance,
        payment.id,
        {
          idempotencyKey: `refund:${randomUUID()}`,
          amountRials: "600",
          reason: "Concurrent refund request alpha",
          scenario: "refund_success",
        },
        { requestId: `race-${randomUUID()}` },
      ),
      createRefund(
        finance,
        payment.id,
        {
          idempotencyKey: `refund:${randomUUID()}`,
          amountRials: "600",
          reason: "Concurrent refund request beta",
          scenario: "refund_success",
        },
        { requestId: `race-${randomUUID()}` },
      ),
    ]);
    expect(
      requests.filter((entry) => entry.status === "fulfilled"),
    ).toHaveLength(1);
    const total = await prisma.refund.aggregate({
      where: {
        paymentId: payment.id,
        status: { in: ["PENDING", "SUCCEEDED"] },
      },
      _sum: { amountRials: true },
    });
    expect(total._sum.amountRials ?? 0n).toBeLessThanOrEqual(1_000n);
  });

  it("replays one refund key without duplicate financial transactions", async () => {
    const payment = await paymentFixture(1_000n);
    const idempotencyKey = `refund:${randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        createRefund(
          finance,
          payment.id,
          {
            idempotencyKey,
            amountRials: "250",
            reason: "Concurrent canonical refund replay",
            scenario: "refund_success",
          },
          { requestId: `race-${randomUUID()}` },
        ),
      ),
    );
    expect(new Set(results.map((entry) => entry.id))).toEqual(
      new Set([payment.id]),
    );
    expect(
      await prisma.refund.count({ where: { paymentId: payment.id } }),
    ).toBe(1);
    expect(
      await prisma.paymentTransaction.count({
        where: { paymentId: payment.id, type: "REFUND" },
      }),
    ).toBe(1);
  });

  it("replays one reconciliation key with one immutable evidence record", async () => {
    const payment = await paymentFixture(1_000n);
    const idempotencyKey = `reconcile:${randomUUID()}`;
    const { reconcileAdminPayment } = await import(
      "@/server/services/payment-service"
    );
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        reconcileAdminPayment(
          finance,
          payment.id,
          { idempotencyKey },
          { requestId: `race-${randomUUID()}` },
        ),
      ),
    );
    expect(results.every((entry) => entry.differenceType === "NONE")).toBe(
      true,
    );
    expect(
      await prisma.paymentReconciliationRecord.count({
        where: { paymentId: payment.id },
      }),
    ).toBe(1);
    expect(
      await prisma.paymentTransaction.count({
        where: { paymentId: payment.id, type: "RECONCILIATION" },
      }),
    ).toBe(1);
  });

  it("persists idempotency evidence across a new Prisma client instance", async () => {
    const payment = await paymentFixture();
    const scope = `restart:${randomUUID()}`;
    const key = `restart:${randomUUID()}`;
    await prisma.paymentIdempotencyRecord.create({
      data: {
        scope,
        key,
        requestHash: "c".repeat(64),
        responseReference: payment.id,
        paymentId: payment.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const restarted = new PrismaClient();
    try {
      await expect(
        restarted.paymentIdempotencyRecord.findUnique({
          where: { scope_key: { scope, key } },
        }),
      ).resolves.toMatchObject({ paymentId: payment.id });
    } finally {
      await restarted.$disconnect();
    }
  });
});
