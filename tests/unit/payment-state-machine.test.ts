import { describe, expect, it } from "vitest";

import {
  assertPaymentTransition,
  canTransitionPayment,
  isPaymentTerminal,
  PaymentStateTransitionError,
} from "@/modules/payments/state-machine";

describe("Phase 08 payment state machine", () => {
  it("permits only governed lifecycle transitions", () => {
    expect(canTransitionPayment("CREATED", "INITIALIZING")).toBe(true);
    expect(canTransitionPayment("PENDING", "PAID")).toBe(true);
    expect(canTransitionPayment("PAID", "FAILED")).toBe(false);
    expect(assertPaymentTransition("PAID", "REFUNDED").eventType).toBe(
      "payment.refunded",
    );
  });

  it("fails closed on an invalid direct paid transition", () => {
    expect(() => assertPaymentTransition("CREATED", "PAID")).toThrow(
      PaymentStateTransitionError,
    );
  });

  it("treats cancelled and refunded states as terminal", () => {
    expect(isPaymentTerminal("CANCELLED")).toBe(true);
    expect(isPaymentTerminal("REFUNDED")).toBe(true);
    expect(isPaymentTerminal("PAID")).toBe(false);
  });
});
