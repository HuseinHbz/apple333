import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { paymentRequestHash } from "@/modules/payments/idempotency";
import { prisma } from "@/server/db/prisma";
import {
  createPaymentForOrder,
  createRefund,
  initializePayment,
  reconcileAdminPayment,
  verifyPayment,
} from "@/server/services/payment-service";
import type { Permission, SessionActor } from "@/server/security/permissions";

const customerId = `phase08-customer-${randomUUID()}`;
const financeId = `phase08-finance-${randomUUID()}`;
const customer: SessionActor = {
  id: customerId,
  isAdmin: false,
  roleCodes: ["CUSTOMER"],
  permissions: new Set<Permission>(),
};
const finance: SessionActor = {
  id: financeId,
  isAdmin: true,
  roleCodes: ["FINANCE_MANAGER"],
  permissions: new Set<Permission>([
    "payments.read",
    "payments.read_financial",
    "payments.verify",
    "payments.reconcile",
    "payments.refund",
    "payments.audit.read",
    "payments.provider_reference.read",
  ]),
};

async function order(amountRials = 5_000_000n) {
  const token = randomUUID();
  return prisma.order.create({
    data: {
      orderNumber: `A33-PAY-${token}`,
      source: "STOREFRONT",
      type: "STANDARD_SALE",
      customerId,
      customerSnapshot: { id: customerId, name: "Phase 08 Customer" },
      currency: "IRR",
      subtotalRials: amountRials,
      grandTotalRials: amountRials,
      fulfillmentMethod: "DELIVERY",
      orderStatus: "PENDING_CONFIRMATION",
    },
  });
}

beforeAll(async () => {
  process.env.APP_URL = "http://127.0.0.1:3000";
  process.env.PAYMENT_SIMULATOR_SECRET =
    "phase08-database-test-simulator-secret-32chars";
  await prisma.user.createMany({
    data: [
      { id: customerId, email: `${customerId}@example.invalid` },
      { id: financeId, email: `${financeId}@example.invalid` },
    ],
    skipDuplicates: true,
  });
});

describe("Phase 08 payment persistence", () => {
  it("resumes an initialization intent persisted before a simulated restart", async () => {
    const persistedOrder = await order(75_000n);
    const context = { requestId: `db-${randomUUID()}` };
    const payment = await createPaymentForOrder(
      customer,
      persistedOrder.orderNumber,
      {
        idempotencyKey: `create:${randomUUID()}`,
        provider: "PAYMENT_SIMULATOR",
      },
      context,
    );
    const input = {
      idempotencyKey: `initialize:${randomUUID()}`,
      scenario: "success" as const,
      returnUrl: `http://127.0.0.1:3000/checkout/payment/${payment.id}/return`,
    };
    const attempt = await prisma.$transaction(async (transaction) => {
      await transaction.payment.update({
        where: { id: payment.id },
        data: { status: "INITIALIZING", version: { increment: 1 } },
      });
      const createdAttempt = await transaction.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          attemptNumber: 1,
          provider: "PAYMENT_SIMULATOR",
          amountRials: 75_000n,
          currency: "IRR",
          status: "INITIALIZING",
          idempotencyKey: input.idempotencyKey,
        },
      });
      await transaction.paymentIdempotencyRecord.create({
        data: {
          scope: `payment:${payment.id}:initialize`,
          key: input.idempotencyKey,
          requestHash: paymentRequestHash({ id: payment.id, input }),
          responseReference: createdAttempt.id,
          paymentId: payment.id,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      return createdAttempt;
    });

    const resumed = await initializePayment(
      customer,
      payment.id,
      input,
      context,
    );
    expect(resumed.status).toBe("PENDING");
    expect(resumed.attempts).toHaveLength(1);
    expect(resumed.attempts[0]?.id).toBe(attempt.id);
    expect(
      await prisma.paymentAttempt.count({ where: { paymentId: payment.id } }),
    ).toBe(1);
  });

  it("derives money from Order and completes a server-verified lifecycle atomically", async () => {
    const persistedOrder = await order();
    const context = { requestId: `db-${randomUUID()}` };
    const created = await createPaymentForOrder(
      customer,
      persistedOrder.orderNumber,
      {
        idempotencyKey: `create:${randomUUID()}`,
        provider: "PAYMENT_SIMULATOR",
      },
      context,
    );
    expect(created.amountRials).toBe(persistedOrder.grandTotalRials.toString());

    const replay = await createPaymentForOrder(
      customer,
      persistedOrder.orderNumber,
      {
        idempotencyKey: `retrieve:${randomUUID()}`,
        provider: "PAYMENT_SIMULATOR",
      },
      context,
    );
    expect(replay.id).toBe(created.id);

    const pending = await initializePayment(
      customer,
      created.id,
      {
        idempotencyKey: `initialize:${randomUUID()}`,
        scenario: "success",
        returnUrl: `http://127.0.0.1:3000/checkout/payment/${created.id}/return`,
      },
      context,
    );
    expect(pending.status).toBe("PENDING");

    const paid = await verifyPayment(
      customer,
      created.id,
      { idempotencyKey: `verify:${randomUUID()}` },
      context,
    );
    expect(paid.status).toBe("PAID");

    const persisted = await prisma.payment.findUniqueOrThrow({
      where: { id: created.id },
      include: { transactions: true, outboxEvents: true, order: true },
    });
    expect(persisted.order.paymentStatus).toBe("PAID");
    expect(
      persisted.transactions.some(
        (entry) => entry.type === "CAPTURE" && entry.status === "SUCCEEDED",
      ),
    ).toBe(true);
    expect(
      persisted.outboxEvents.some(
        (entry) => entry.eventType === "payment.paid",
      ),
    ).toBe(true);
  });

  it("never marks a mismatched provider amount paid", async () => {
    const persistedOrder = await order(9_000n);
    const context = { requestId: `db-${randomUUID()}` };
    const payment = await createPaymentForOrder(
      customer,
      persistedOrder.orderNumber,
      {
        idempotencyKey: `create:${randomUUID()}`,
        provider: "PAYMENT_SIMULATOR",
      },
      context,
    );
    await initializePayment(
      customer,
      payment.id,
      {
        idempotencyKey: `initialize:${randomUUID()}`,
        scenario: "wrong_amount",
        returnUrl: `http://127.0.0.1:3000/checkout/payment/${payment.id}/return`,
      },
      context,
    );
    const failed = await verifyPayment(
      customer,
      payment.id,
      { idempotencyKey: `verify:${randomUUID()}` },
      context,
    );
    expect(failed.status).toBe("FAILED");
    const orderAfter = await prisma.order.findUniqueOrThrow({
      where: { id: persistedOrder.id },
    });
    expect(orderAfter.paymentStatus).not.toBe("PAID");
  });

  it("enforces immutable transactions and non-negative database money", async () => {
    const persistedOrder = await order(12_000n);
    const payment = await prisma.payment.create({
      data: {
        orderId: persistedOrder.id,
        paymentNumber: `PAY-DB-${randomUUID()}`,
        amountRials: 12_000n,
        currency: "IRR",
        provider: "PAYMENT_SIMULATOR",
      },
    });
    const transaction = await prisma.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        type: "INITIALIZATION",
        amountRials: 12_000n,
        status: "SUCCEEDED",
      },
    });
    await expect(
      prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: "FAILED" },
      }),
    ).rejects.toBeTruthy();
    await expect(
      prisma.payment.create({
        data: {
          orderId: (await order(1n)).id,
          paymentNumber: `PAY-NEG-${randomUUID()}`,
          amountRials: -1n,
          currency: "IRR",
          provider: "PAYMENT_SIMULATOR",
        },
      }),
    ).rejects.toBeTruthy();
  });

  it("enforces refund bounds and records zero-drift reconciliation", async () => {
    const persistedOrder = await order(20_000n);
    const context = { requestId: `db-${randomUUID()}` };
    const created = await createPaymentForOrder(
      customer,
      persistedOrder.orderNumber,
      {
        idempotencyKey: `create:${randomUUID()}`,
        provider: "PAYMENT_SIMULATOR",
      },
      context,
    );
    await initializePayment(
      customer,
      created.id,
      {
        idempotencyKey: `initialize:${randomUUID()}`,
        scenario: "success",
        returnUrl: `http://127.0.0.1:3000/checkout/payment/${created.id}/return`,
      },
      context,
    );
    await verifyPayment(
      customer,
      created.id,
      { idempotencyKey: `verify:${randomUUID()}` },
      context,
    );
    const refunded = await createRefund(
      finance,
      created.id,
      {
        idempotencyKey: `refund:${randomUUID()}`,
        amountRials: "20000",
        reason: "Phase 08 accepted full return",
        scenario: "refund_success",
      },
      context,
    );
    expect(refunded.status).toBe("REFUNDED");
    await expect(
      createRefund(
        finance,
        created.id,
        {
          idempotencyKey: `refund:${randomUUID()}`,
          amountRials: "1",
          reason: "Attempt beyond captured total",
          scenario: "refund_success",
        },
        context,
      ),
    ).rejects.toMatchObject({ code: "REFUND_NOT_ALLOWED" });
    const reconciliation = await reconcileAdminPayment(
      finance,
      created.id,
      {
        idempotencyKey: `reconcile:${randomUUID()}`,
      },
      context,
    );
    expect(reconciliation.differenceType).toBe("NONE");
  });
});
