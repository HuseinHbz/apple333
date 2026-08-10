import { describe, expect, it } from "vitest";

import {
  cancelOrderInput,
  createAdminOrderInput,
  createOrderFromCartInput,
  createOrderNoteInput,
  orderListQuery,
  orderMoneyRialsInput,
  transitionOrderStatusInput,
} from "@/modules/orders/validators";

const CUSTOMER_ID = "cmcy9c9xc000008l7a4tf7kg1";
const VARIANT_ID = "cmcy9c9xc000108l7a4tf7kg2";
const OTHER_VARIANT_ID = "cmcy9c9xc000208l7a4tf7kg3";
const BRANCH_ID = "cmcy9c9xc000308l7a4tf7kg4";
const ADDRESS_ID = "cmcy9c9xc000408l7a4tf7kg5";
const IDEMPOTENCY_KEY = "order-test-key-0001";

describe("order input validation", () => {
  it("accepts delivery checkout without client-controlled financial fields", () => {
    expect(
      createOrderFromCartInput.parse({
        fulfillmentMethod: "DELIVERY",
        shippingAddressId: ADDRESS_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).toMatchObject({
      fulfillmentMethod: "DELIVERY",
      shippingAddressId: ADDRESS_ID,
    });

    expect(() =>
      createOrderFromCartInput.parse({
        fulfillmentMethod: "DELIVERY",
        shippingAddressId: ADDRESS_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
        grandTotalRials: "1",
      }),
    ).toThrow();
  });

  it("enforces mutually exclusive fulfillment selections", () => {
    expect(
      createOrderFromCartInput.parse({
        fulfillmentMethod: "PICKUP",
        pickupBranchId: BRANCH_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).toMatchObject({ fulfillmentMethod: "PICKUP", pickupBranchId: BRANCH_ID });
    expect(() =>
      createOrderFromCartInput.parse({
        fulfillmentMethod: "PICKUP",
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).toThrow();
    expect(() =>
      createOrderFromCartInput.parse({
        fulfillmentMethod: "DELIVERY",
        shippingAddressId: ADDRESS_ID,
        pickupBranchId: BRANCH_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).toThrow();
  });

  it("accepts admin item requests but rejects duplicated variants and direct price submission", () => {
    expect(
      createAdminOrderInput.parse({
        customerId: CUSTOMER_ID,
        fulfillmentMethod: "DELIVERY",
        shippingAddressId: ADDRESS_ID,
        items: [
          { variantId: VARIANT_ID, quantity: 1 },
          { variantId: OTHER_VARIANT_ID, quantity: 2 },
        ],
        idempotencyKey: IDEMPOTENCY_KEY,
      }).source,
    ).toBe("ADMIN");
    expect(() =>
      createAdminOrderInput.parse({
        customerId: CUSTOMER_ID,
        fulfillmentMethod: "DELIVERY",
        shippingAddressId: ADDRESS_ID,
        items: [
          { variantId: VARIANT_ID, quantity: 1 },
          { variantId: VARIANT_ID, quantity: 1 },
        ],
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).toThrow();
    expect(() =>
      createAdminOrderInput.parse({
        customerId: CUSTOMER_ID,
        fulfillmentMethod: "DELIVERY",
        shippingAddressId: ADDRESS_ID,
        items: [{ variantId: VARIANT_ID, quantity: 1, unitPriceRials: "1" }],
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).toThrow();
  });

  it("requires an optimistic version and a reason for sensitive state changes", () => {
    expect(
      transitionOrderStatusInput.parse({
        toStatus: "PROCESSING",
        expectedVersion: 2,
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).toMatchObject({ expectedVersion: 2 });
    expect(() =>
      transitionOrderStatusInput.parse({
        toStatus: "CANCELLED",
        expectedVersion: 2,
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).toThrow();
    expect(
      cancelOrderInput.parse({
        expectedVersion: 2,
        reasonCode: "customer-request",
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).toMatchObject({ reasonCode: "customer-request" });
    expect(() =>
      createOrderNoteInput.parse({
        visibility: "INTERNAL",
        content: "Internal note",
      }),
    ).toThrow();
    expect(
      createOrderNoteInput.parse({
        visibility: "INTERNAL",
        content: "Internal note",
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).toMatchObject({ idempotencyKey: IDEMPOTENCY_KEY });
  });

  it("preserves exact money input and enforces signed-64-bit range", () => {
    expect(orderMoneyRialsInput.parse("9007199254740993")).toBe(
      9_007_199_254_740_993n,
    );
    expect(() => orderMoneyRialsInput.parse("1.5")).toThrow();
    expect(() => orderMoneyRialsInput.parse("-1")).toThrow();
    expect(() => orderMoneyRialsInput.parse("9223372036854775808")).toThrow();
  });

  it("keeps order list queries bounded, strict, and chronologically valid", () => {
    expect(
      orderListQuery.parse({ page: "2", pageSize: "50", status: "CONFIRMED" }),
    ).toMatchObject({ page: 2, pageSize: 50, status: "CONFIRMED" });
    expect(() => orderListQuery.parse({ pageSize: 101 })).toThrow();
    expect(() => orderListQuery.parse({ unknown: true })).toThrow();
    expect(() =>
      orderListQuery.parse({
        createdFrom: "2026-01-02",
        createdTo: "2026-01-01",
      }),
    ).toThrow();
  });
});
