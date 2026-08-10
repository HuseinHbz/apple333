import { describe, expect, it } from "vitest";

import {
  assertOrderStatusTransition,
  canTransitionOrderStatus,
  evaluateOrderStatusTransition,
  getOrderTransitionEffects,
  isTerminalOrderStatus,
  OrderStateTransitionError,
} from "@/modules/orders/state-machine";

describe("order state machine", () => {
  it("allows only lifecycle transitions from the declared graph", () => {
    expect(canTransitionOrderStatus("DRAFT", "PENDING_CONFIRMATION")).toBe(
      true,
    );
    expect(canTransitionOrderStatus("PENDING_CONFIRMATION", "CONFIRMED")).toBe(
      true,
    );
    expect(canTransitionOrderStatus("CONFIRMED", "COMPLETED")).toBe(false);
    expect(canTransitionOrderStatus("COMPLETED", "CANCELLED")).toBe(false);
    expect(isTerminalOrderStatus("COMPLETED")).toBe(true);
    expect(isTerminalOrderStatus("PROCESSING")).toBe(false);
  });

  it("fails closed when a draft lacks commercial snapshot preconditions", () => {
    const evaluation = evaluateOrderStatusTransition({
      fromStatus: "DRAFT",
      toStatus: "PENDING_CONFIRMATION",
      context: {},
    });
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.violations).toHaveLength(3);
    expect(() =>
      assertOrderStatusTransition({
        fromStatus: "DRAFT",
        toStatus: "PENDING_CONFIRMATION",
        context: {},
      }),
    ).toThrow(OrderStateTransitionError);
  });

  it("requires reservation, allocation and payment policy before confirmation", () => {
    const base = {
      fromStatus: "PENDING_CONFIRMATION" as const,
      toStatus: "CONFIRMED" as const,
    };
    expect(evaluateOrderStatusTransition(base).allowed).toBe(false);
    expect(
      assertOrderStatusTransition({
        ...base,
        context: {
          reservationActive: true,
          allocationStatus: "ALLOCATED",
          paymentPolicyAllowsConfirmation: true,
        },
      }),
    ).toMatchObject({
      fromStatus: "PENDING_CONFIRMATION",
      toStatus: "CONFIRMED",
    });
  });

  it("requires payment and delivered or collected fulfillment before completion", () => {
    expect(
      evaluateOrderStatusTransition({
        fromStatus: "PROCESSING",
        toStatus: "COMPLETED",
        context: { fulfillmentStatus: "DELIVERED", paymentStatus: "PENDING" },
      }).allowed,
    ).toBe(false);

    expect(
      assertOrderStatusTransition({
        fromStatus: "PROCESSING",
        toStatus: "COMPLETED",
        context: {
          fulfillmentMethod: "PICKUP",
          pickupCollected: true,
          paymentStatus: "PAID",
        },
      }),
    ).toMatchObject({ toStatus: "COMPLETED" });
  });

  it("requires a reason and exposes cancellation side effects for paid orders", () => {
    expect(() =>
      assertOrderStatusTransition({
        fromStatus: "CONFIRMED",
        toStatus: "CANCELLED",
      }),
    ).toThrow(/reasonCode/i);

    const transition = assertOrderStatusTransition({
      fromStatus: "CONFIRMED",
      toStatus: "CANCELLED",
      reasonCode: " customer-request ",
      context: { paymentStatus: "PAID" },
    });
    expect(transition.reasonCode).toBe("customer-request");
    expect(transition.effects).toEqual(
      expect.arrayContaining([
        "RELEASE_INVENTORY_RESERVATIONS",
        "REVERSE_INVENTORY_ALLOCATION",
        "CANCEL_PENDING_PAYMENT_ATTEMPTS",
        "CREATE_REFUND_REQUIRED_EVENT",
        "WRITE_STATUS_HISTORY",
        "WRITE_AUDIT_RECORD",
      ]),
    );
    expect(
      getOrderTransitionEffects("PENDING_CONFIRMATION", "CANCELLED"),
    ).not.toContain("REVERSE_INVENTORY_ALLOCATION");
  });

  it("rejects cancellation once an order has been shipped or delivered", () => {
    expect(
      evaluateOrderStatusTransition({
        fromStatus: "PROCESSING",
        toStatus: "CANCELLED",
        reasonCode: "customer-request",
        context: { fulfillmentStatus: "SHIPPED" },
      }).allowed,
    ).toBe(false);
  });
});
