import { describe, expect, it } from "vitest";

import type {
  OrderDetailRecord,
  OrderListRecord,
} from "@/server/repositories/order-repository";
import { mapOrderDetail, mapOrderList } from "@/server/services/order-service";

const createdAt = new Date("2026-07-29T12:00:00.000Z");

function detailRecord(): OrderDetailRecord {
  return {
    id: "order-projection-1",
    orderNumber: "A33-20260729-PROJECTION",
    source: "ADMIN",
    type: "STANDARD_SALE",
    customerId: "customer-projection-1",
    sourceCartId: null,
    guestTokenHash: null,
    customerSnapshot: {
      id: "customer-projection-1",
      name: "Sensitive Customer",
      email: "customer@example.test",
      mobile: "09120000000",
    },
    billingAddressSnapshot: null,
    shippingAddressSnapshot: null,
    currency: "IRR",
    subtotalRials: 987_654n,
    discountTotalRials: 0n,
    taxTotalRials: 0n,
    shippingTotalRials: 0n,
    feeTotalRials: 0n,
    grandTotalRials: 987_654n,
    paymentStatus: "UNPAID",
    fulfillmentStatus: "UNFULFILLED",
    fulfillmentMethod: "DELIVERY",
    orderStatus: "PENDING_CONFIRMATION",
    allocationStatus: "ALLOCATED",
    version: 2,
    items: [
      {
        id: "item-projection-1",
        productId: "product-projection-1",
        variantId: "variant-projection-1",
        productSkuId: "sku-projection-1",
        sku: "PROJECTION-SKU",
        productName: "Projection Device",
        variantName: "256GB",
        quantity: 1,
        unitPriceRials: 987_654n,
        discountAmountRials: 0n,
        taxAmountRials: 0n,
        lineTotalRials: 987_654n,
        warrantySnapshot: null,
        attributesSnapshot: {},
        createdAt,
        updatedAt: createdAt,
      },
    ],
    allocations: [],
    payments: [
      {
        id: "payment-projection-1",
        provider: "MANUAL",
        method: "CASH",
        amountRials: 987_654n,
        status: "UNPAID",
        providerReference: "sensitive-provider-reference",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    fulfillment: null,
    statusHistory: [],
    notes: [],
    createdAt,
    updatedAt: createdAt,
  } as unknown as OrderDetailRecord;
}

function listRecord(): OrderListRecord {
  return {
    id: "order-list-projection-1",
    orderNumber: "A33-20260729-LIST",
    source: "ADMIN",
    type: "STANDARD_SALE",
    customerId: "customer-projection-1",
    customerSnapshot: {
      id: "customer-projection-1",
      name: "Sensitive Customer",
    },
    currency: "IRR",
    subtotalRials: 987_654n,
    discountTotalRials: 0n,
    taxTotalRials: 0n,
    shippingTotalRials: 0n,
    feeTotalRials: 0n,
    grandTotalRials: 987_654n,
    paymentStatus: "UNPAID",
    fulfillmentStatus: "UNFULFILLED",
    fulfillmentMethod: "DELIVERY",
    orderStatus: "PENDING_CONFIRMATION",
    allocationStatus: "ALLOCATED",
    version: 2,
    allocations: [],
    _count: { items: 1 },
    createdAt,
    updatedAt: createdAt,
  } as unknown as OrderListRecord;
}

describe("Phase 07 financial order projections", () => {
  it("does not leak totals, line amounts, payment records, or provider references to a non-finance admin projection", () => {
    const projected = mapOrderDetail(detailRecord(), false, false, false);

    expect(projected.pricing).toBeNull();
    expect(projected.items[0]).toMatchObject({
      unitPriceRials: null,
      discountAmountRials: null,
      taxAmountRials: null,
      lineTotalRials: null,
    });
    expect(projected.payments).toEqual([]);
    expect(JSON.stringify(projected)).not.toContain("987654");
    expect(JSON.stringify(projected)).not.toContain(
      "sensitive-provider-reference",
    );
  });

  it("keeps financial snapshots available to an authorized customer or finance projection", () => {
    const projected = mapOrderDetail(detailRecord(), true, true, true);

    expect(projected.pricing).toMatchObject({ grandTotalRials: "987654" });
    expect(projected.items[0]?.lineTotalRials).toBe("987654");
    expect(projected.payments[0]).toMatchObject({ amountRials: "987654" });
  });

  it("omits list totals unless the caller has independent financial visibility", () => {
    expect(mapOrderList(listRecord(), false, false).grandTotalRials).toBeNull();
    expect(mapOrderList(listRecord(), false, true).grandTotalRials).toBe(
      "987654",
    );
  });
});
