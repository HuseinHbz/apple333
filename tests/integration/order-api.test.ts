import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Permission, SessionActor } from "@/server/security/permissions";

const mocks = vi.hoisted(() => ({
  requireActor: vi.fn(),
  requireAdminActor: vi.fn(),
  log: vi.fn(),
  createStorefrontOrder: vi.fn(),
  createAdminOrder: vi.fn(),
  getCustomerOrder: vi.fn(),
  listCustomerOrders: vi.fn(),
  listAdminOrders: vi.fn(),
  getAdminOrder: vi.fn(),
  confirmOrder: vi.fn(),
  cancelOrder: vi.fn(),
  createOrderFulfillment: vi.fn(),
  recordOrderPayment: vi.fn(),
  addOrderNote: vi.fn(),
  revalidateStorefrontInventory: vi.fn(),
}));

vi.mock("@/modules/auth/session", () => ({
  requireActor: mocks.requireActor,
  requireAdminActor: mocks.requireAdminActor,
}));
vi.mock("@/server/logging/logger", () => ({ log: mocks.log }));
vi.mock("@/server/services/storefront-inventory-cache", () => ({
  revalidateStorefrontInventory: mocks.revalidateStorefrontInventory,
}));
vi.mock("@/server/services/order-service", () => ({
  createStorefrontOrder: mocks.createStorefrontOrder,
  createAdminOrder: mocks.createAdminOrder,
  getCustomerOrder: mocks.getCustomerOrder,
  listCustomerOrders: mocks.listCustomerOrders,
  listAdminOrders: mocks.listAdminOrders,
  getAdminOrder: mocks.getAdminOrder,
  confirmOrder: mocks.confirmOrder,
  cancelOrder: mocks.cancelOrder,
  createOrderFulfillment: mocks.createOrderFulfillment,
  recordOrderPayment: mocks.recordOrderPayment,
  addOrderNote: mocks.addOrderNote,
}));

import { GET as adminOrderDetail } from "@/app/api/admin/orders/[id]/route";
import { POST as adminOrderCancel } from "@/app/api/admin/orders/[id]/cancel/route";
import { POST as adminOrderConfirm } from "@/app/api/admin/orders/[id]/confirm/route";
import { POST as adminOrderFulfillmentAlias } from "@/app/api/admin/orders/[id]/fulfillment/route";
import { POST as adminOrderFulfillments } from "@/app/api/admin/orders/[id]/fulfillments/route";
import { POST as adminOrderNote } from "@/app/api/admin/orders/[id]/notes/route";
import { POST as adminOrderPayment } from "@/app/api/admin/orders/[id]/payment/route";
import { GET as adminOrderTimeline } from "@/app/api/admin/orders/[id]/timeline/route";
import {
  GET as adminOrders,
  POST as createAdminOrder,
} from "@/app/api/admin/orders/route";
import { POST as customerOrderCancel } from "@/app/api/store/orders/[orderNumber]/cancel/route";
import { GET as customerOrderDetail } from "@/app/api/store/orders/[orderNumber]/route";
import {
  GET as customerOrders,
  POST as createCustomerOrder,
} from "@/app/api/store/orders/route";

const CUSTOMER_ID = "cmcy9c9xc000008l7a4tf7kg1";
const ORDER_ID = "cmcy9c9xc000108l7a4tf7kg2";
const ADDRESS_ID = "cmcy9c9xc000208l7a4tf7kg3";
const ORDER_NUMBER = "A33-20260729-ABCDEF123456";
const TEST_ORIGIN = new URL(process.env.APP_URL ?? "http://localhost:3000")
  .origin;

const customerActor: SessionActor = {
  id: CUSTOMER_ID,
  isAdmin: false,
  roleCodes: [],
  permissions: new Set<Permission>(["orders.read_own", "orders.create"]),
};

const adminActor: SessionActor = {
  id: "cmcy9c9xc000308l7a4tf7kg4",
  isAdmin: true,
  roleCodes: ["ORDER_MANAGER"],
  permissions: new Set<Permission>([
    "orders.read",
    "orders.create_admin",
    "orders.confirm",
    "orders.cancel",
    "orders.cancel_after_payment",
    "orders.fulfill",
    "orders.view_financials",
    "orders.add_internal_note",
    "orders.update",
  ]),
};

function request(path: string, init?: RequestInit): Request {
  return new Request(new URL(path, TEST_ORIGIN), init);
}

function mutation(path: string, body: unknown, origin = TEST_ORIGIN): Request {
  return request(path, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "x-request-id": "order_api_1234",
    },
    body: JSON.stringify(body),
  });
}

const orderDetail = {
  id: ORDER_ID,
  orderNumber: ORDER_NUMBER,
  timeline: [{ id: "history_1" }],
};
const page = { items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 };

describe("Phase 07 order API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActor.mockResolvedValue(customerActor);
    mocks.requireAdminActor.mockResolvedValue(adminActor);
    mocks.createStorefrontOrder.mockResolvedValue(orderDetail);
    mocks.createAdminOrder.mockResolvedValue(orderDetail);
    mocks.getCustomerOrder.mockResolvedValue(orderDetail);
    mocks.listCustomerOrders.mockResolvedValue(page);
    mocks.listAdminOrders.mockResolvedValue(page);
    mocks.getAdminOrder.mockResolvedValue(orderDetail);
    mocks.confirmOrder.mockResolvedValue(orderDetail);
    mocks.cancelOrder.mockResolvedValue(orderDetail);
    mocks.createOrderFulfillment.mockResolvedValue(orderDetail);
    mocks.recordOrderPayment.mockResolvedValue(orderDetail);
    mocks.addOrderNote.mockResolvedValue(orderDetail);
  });

  it("lists only the authenticated customer order view through the private store route", async () => {
    const response = await customerOrders(
      request("/api/store/orders?page=2&pageSize=10"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.listCustomerOrders).toHaveBeenCalledWith(
      customerActor,
      expect.objectContaining({ page: 2, pageSize: 10 }),
    );
  });

  it("rejects client-controlled financial totals before storefront order creation", async () => {
    const response = await createCustomerOrder(
      mutation("/api/store/orders", {
        fulfillmentMethod: "DELIVERY",
        shippingAddressId: ADDRESS_ID,
        idempotencyKey: "customer-order-key-0001",
        grandTotalRials: "1",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.createStorefrontOrder).not.toHaveBeenCalled();
  });

  it("creates a customer order only through same-origin checkout input", async () => {
    const response = await createCustomerOrder(
      mutation("/api/store/orders", {
        fulfillmentMethod: "DELIVERY",
        shippingAddressId: ADDRESS_ID,
        idempotencyKey: "customer-order-key-0002",
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.createStorefrontOrder).toHaveBeenCalledWith(
      customerActor,
      expect.any(String),
      expect.objectContaining({
        fulfillmentMethod: "DELIVERY",
        shippingAddressId: ADDRESS_ID,
      }),
      expect.objectContaining({ requestId: "order_api_1234" }),
    );
  });

  it("rate limits repeated storefront order mutations before an invalid request can reach the service", async () => {
    vi.stubEnv("APPLE333_TRUST_PROXY_HEADERS", "true");
    const clientIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    const invalidRequest = () =>
      request("/api/store/orders", {
        method: "POST",
        headers: {
          origin: TEST_ORIGIN,
          "content-type": "application/json",
          "x-real-ip": clientIp,
        },
        body: JSON.stringify({}),
      });

    try {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        expect((await createCustomerOrder(invalidRequest())).status).toBe(400);
      }
      expect((await createCustomerOrder(invalidRequest())).status).toBe(429);
      expect(mocks.createStorefrontOrder).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("validates a customer order number before loading the order", async () => {
    const response = await customerOrderDetail(request("/api/store/orders/!"), {
      params: Promise.resolve({ orderNumber: "!" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.getCustomerOrder).not.toHaveBeenCalled();
  });

  it("resolves customer-owned order numbers before cancellation and applies CSRF protection", async () => {
    const rejected = await customerOrderCancel(
      mutation(
        `/api/store/orders/${ORDER_NUMBER}/cancel`,
        {
          expectedVersion: 1,
          reasonCode: "customer-request",
          idempotencyKey: "customer-cancel-key-0001",
        },
        "https://untrusted.example",
      ),
      { params: Promise.resolve({ orderNumber: ORDER_NUMBER }) },
    );
    expect(rejected.status).toBe(403);
    expect(mocks.cancelOrder).not.toHaveBeenCalled();

    const response = await customerOrderCancel(
      mutation(`/api/store/orders/${ORDER_NUMBER}/cancel`, {
        expectedVersion: 1,
        reasonCode: "customer-request",
        idempotencyKey: "customer-cancel-key-0001",
      }),
      { params: Promise.resolve({ orderNumber: ORDER_NUMBER }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.getCustomerOrder).toHaveBeenCalledWith(
      customerActor,
      ORDER_NUMBER,
    );
    expect(mocks.cancelOrder).toHaveBeenCalledWith(
      customerActor,
      ORDER_ID,
      expect.objectContaining({ expectedVersion: 1 }),
      expect.anything(),
    );
  });

  it("bounds administrative lists and prevents cross-origin order creation", async () => {
    const invalid = await adminOrders(request("/api/admin/orders?page=0"));
    expect(invalid.status).toBe(400);
    expect(mocks.listAdminOrders).not.toHaveBeenCalled();

    const rejected = await createAdminOrder(
      mutation(
        "/api/admin/orders",
        {
          customerId: CUSTOMER_ID,
          fulfillmentMethod: "DELIVERY",
          shippingAddressId: ADDRESS_ID,
          items: [{ variantId: ORDER_ID, quantity: 1 }],
          idempotencyKey: "admin-order-key-0001",
        },
        "https://untrusted.example",
      ),
    );
    expect(rejected.status).toBe(403);
    expect(mocks.createAdminOrder).not.toHaveBeenCalled();
  });

  it("forwards validated admin detail and lifecycle commands to their services", async () => {
    const detail = await adminOrderDetail(
      request(`/api/admin/orders/${ORDER_ID}`),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );
    expect(detail.status).toBe(200);
    expect(mocks.getAdminOrder).toHaveBeenCalledWith(
      adminActor,
      ORDER_ID,
      expect.objectContaining({ requestId: expect.any(String) }),
    );

    const confirmed = await adminOrderConfirm(
      mutation(`/api/admin/orders/${ORDER_ID}/confirm`, {
        expectedVersion: 1,
        idempotencyKey: "admin-confirm-key-0001",
      }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );
    expect(confirmed.status).toBe(200);
    expect(mocks.confirmOrder).toHaveBeenCalledWith(
      adminActor,
      ORDER_ID,
      expect.objectContaining({ expectedVersion: 1 }),
      expect.anything(),
    );

    const cancelled = await adminOrderCancel(
      mutation(`/api/admin/orders/${ORDER_ID}/cancel`, {
        expectedVersion: 2,
        reasonCode: "operator-request",
        idempotencyKey: "admin-cancel-key-0001",
      }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );
    expect(cancelled.status).toBe(200);
    expect(mocks.cancelOrder).toHaveBeenCalledWith(
      adminActor,
      ORDER_ID,
      expect.objectContaining({ reasonCode: "operator-request" }),
      expect.anything(),
    );
  });

  it("uses the canonical plural fulfillment endpoint and keeps the singular alias operational", async () => {
    const payload = {
      method: "DELIVERY",
      status: "PENDING",
      expectedVersion: 1,
      idempotencyKey: "admin-fulfillment-key-0001",
    };
    const plural = await adminOrderFulfillments(
      mutation(`/api/admin/orders/${ORDER_ID}/fulfillments`, payload),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );
    const alias = await adminOrderFulfillmentAlias(
      mutation(`/api/admin/orders/${ORDER_ID}/fulfillment`, {
        ...payload,
        idempotencyKey: "admin-fulfillment-key-0002",
      }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );

    expect(plural.status).toBe(200);
    expect(alias.status).toBe(200);
    expect(mocks.createOrderFulfillment).toHaveBeenCalledTimes(2);
  });

  it("exposes timeline, notes, and payment only through their protected admin routes", async () => {
    const timeline = await adminOrderTimeline(
      request(`/api/admin/orders/${ORDER_ID}/timeline`),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );
    const timelineBody = (await timeline.json()) as {
      data: { timeline: unknown[] };
    };
    expect(timeline.status).toBe(200);
    expect(timelineBody.data.timeline).toEqual(orderDetail.timeline);

    const note = await adminOrderNote(
      mutation(`/api/admin/orders/${ORDER_ID}/notes`, {
        visibility: "INTERNAL",
        content: "Prepare device for pickup.",
        idempotencyKey: "admin-note-key-0001",
      }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );
    expect(note.status).toBe(200);
    expect(mocks.addOrderNote).toHaveBeenCalledWith(
      adminActor,
      ORDER_ID,
      expect.objectContaining({ visibility: "INTERNAL" }),
      expect.anything(),
    );

    const payment = await adminOrderPayment(
      mutation(`/api/admin/orders/${ORDER_ID}/payment`, {
        provider: "manual",
        method: "BANK_TRANSFER",
        expectedVersion: 2,
        idempotencyKey: "admin-payment-key-0001",
      }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );
    expect(payment.status).toBe(200);
    expect(mocks.recordOrderPayment).toHaveBeenCalledWith(
      adminActor,
      ORDER_ID,
      expect.objectContaining({ provider: "manual" }),
      expect.anything(),
    );
  });
});
