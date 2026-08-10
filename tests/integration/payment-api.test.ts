import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Permission, SessionActor } from "@/server/security/permissions";

const mocks = vi.hoisted(() => ({
  requireActor: vi.fn(),
  requireAdminActor: vi.fn(),
  log: vi.fn(),
  createPaymentForOrder: vi.fn(),
  getCustomerPayment: vi.fn(),
  initializePayment: vi.fn(),
  verifyPayment: vi.fn(),
  processPaymentCallback: vi.fn(),
  listAdminPayments: vi.fn(),
  getAdminPayment: vi.fn(),
  reconcileAdminPayment: vi.fn(),
  createRefund: vi.fn(),
}));

vi.mock("@/modules/auth/session", () => ({
  requireActor: mocks.requireActor,
  requireAdminActor: mocks.requireAdminActor,
}));
vi.mock("@/server/logging/logger", () => ({ log: mocks.log }));
vi.mock("@/server/services/payment-service", () => ({
  createPaymentForOrder: mocks.createPaymentForOrder,
  getCustomerPayment: mocks.getCustomerPayment,
  initializePayment: mocks.initializePayment,
  verifyPayment: mocks.verifyPayment,
  processPaymentCallback: mocks.processPaymentCallback,
  listAdminPayments: mocks.listAdminPayments,
  getAdminPayment: mocks.getAdminPayment,
  reconcileAdminPayment: mocks.reconcileAdminPayment,
  createRefund: mocks.createRefund,
}));

import { POST as adminRefund } from "@/app/api/admin/payments/[id]/refunds/route";
import { GET as adminPayments } from "@/app/api/admin/payments/route";
import { POST as callback } from "@/app/api/payments/callback/[provider]/route";
import { POST as initialize } from "@/app/api/store/payments/[id]/initialize/route";
import { POST as createPayment } from "@/app/api/store/orders/[orderNumber]/payments/route";

const origin = new URL(process.env.APP_URL ?? "http://localhost:3000").origin;
const paymentId = "payment0000000001";
const orderNumber = "A33-20260810-ABCDEF123456";

const customer: SessionActor = {
  id: "customer00000001",
  isAdmin: false,
  roleCodes: ["CUSTOMER"],
  permissions: new Set<Permission>(["orders.read_own"]),
};
const finance: SessionActor = {
  id: "finance000000001",
  isAdmin: true,
  roleCodes: ["FINANCE_MANAGER"],
  permissions: new Set<Permission>([
    "payments.read",
    "payments.read_financial",
    "payments.refund",
  ]),
};

function mutation(path: string, body: unknown, requestOrigin = origin) {
  return new Request(new URL(path, origin), {
    method: "POST",
    headers: {
      origin: requestOrigin,
      "content-type": "application/json",
      "x-request-id": "payment_api_1234",
    },
    body: JSON.stringify(body),
  });
}

describe("Phase 08 payment API contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActor.mockResolvedValue(customer);
    mocks.requireAdminActor.mockResolvedValue(finance);
    mocks.createPaymentForOrder.mockResolvedValue({ id: paymentId });
    mocks.initializePayment.mockResolvedValue({
      id: paymentId,
      status: "PENDING",
    });
    mocks.listAdminPayments.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
      totalPages: 0,
    });
    mocks.createRefund.mockResolvedValue({ id: paymentId, status: "REFUNDED" });
    mocks.processPaymentCallback.mockResolvedValue({
      id: paymentId,
      status: "PAID",
    });
  });

  it("rejects a browser-supplied payment amount before the service boundary", async () => {
    const response = await createPayment(
      mutation(`/api/store/orders/${orderNumber}/payments`, {
        idempotencyKey: "payment-create-key-0001",
        provider: "PAYMENT_SIMULATOR",
        amountRials: "1",
      }),
      { params: Promise.resolve({ orderNumber }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.createPaymentForOrder).not.toHaveBeenCalled();
  });

  it("requires same-origin protection for customer initialization", async () => {
    const response = await initialize(
      mutation(
        `/api/store/payments/${paymentId}/initialize`,
        {
          idempotencyKey: "payment-initialize-key-0001",
          scenario: "success",
          returnUrl: `${origin}/checkout/payment/${paymentId}/return`,
        },
        "https://untrusted.example",
      ),
      { params: Promise.resolve({ id: paymentId }) },
    );
    expect(response.status).toBe(403);
    expect(mocks.initializePayment).not.toHaveBeenCalled();
  });

  it("lists admin payments through the dedicated payment permission", async () => {
    const response = await adminPayments(
      new Request(`${origin}/api/admin/payments?status=PAID`),
    );
    expect(response.status).toBe(200);
    expect(mocks.listAdminPayments).toHaveBeenCalledWith(
      finance,
      expect.objectContaining({ status: "PAID" }),
    );
  });

  it("validates controlled refund money and reason", async () => {
    const response = await adminRefund(
      mutation(`/api/admin/payments/${paymentId}/refunds`, {
        idempotencyKey: "payment-refund-key-0001",
        amountRials: "1000",
        reason: "customer return accepted",
        scenario: "refund_success",
      }),
      { params: Promise.resolve({ id: paymentId }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.createRefund).toHaveBeenCalledWith(
      finance,
      paymentId,
      expect.objectContaining({ amountRials: "1000" }),
      expect.objectContaining({ requestId: "payment_api_1234" }),
    );
  });

  it("accepts provider callbacks without same-origin browser headers but keeps validation", async () => {
    const response = await callback(
      new Request(`${origin}/api/payments/callback/PAYMENT_SIMULATOR`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          externalEventId: "event0000000001",
          authority: "authority0000001",
          signature: "a".repeat(64),
          scenario: "success",
        }),
      }),
      { params: Promise.resolve({ provider: "PAYMENT_SIMULATOR" }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.processPaymentCallback).toHaveBeenCalledOnce();
  });

  it("fails malformed callback JSON as validation input without invoking the service", async () => {
    const response = await callback(
      new Request(`${origin}/api/payments/callback/PAYMENT_SIMULATOR`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      }),
      { params: Promise.resolve({ provider: "PAYMENT_SIMULATOR" }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.processPaymentCallback).not.toHaveBeenCalled();
  });
});
