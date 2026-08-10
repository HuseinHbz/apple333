import { describe, expect, it } from "vitest";

import {
  createPaymentInput,
  createRefundInput,
  initializePaymentInput,
  paymentCallbackInput,
  paymentListQuery,
} from "@/modules/payments/validators";

describe("Phase 08 payment input validation", () => {
  it("rejects browser-controlled amount during payment creation", () => {
    expect(
      createPaymentInput.safeParse({
        idempotencyKey: "payment-create-key-0001",
        provider: "PAYMENT_SIMULATOR",
        amountRials: "1",
      }).success,
    ).toBe(false);
  });

  it("allows only a validated simulator scenario and absolute return URL", () => {
    expect(
      initializePaymentInput.safeParse({
        idempotencyKey: "payment-init-key-0001",
        scenario: "success",
        returnUrl: "http://127.0.0.1:3000/checkout/return",
      }).success,
    ).toBe(true);
    expect(
      initializePaymentInput.safeParse({
        idempotencyKey: "payment-init-key-0001",
        scenario: "fake_success",
        returnUrl: "/relative",
      }).success,
    ).toBe(false);
  });

  it("requires positive integer refunds and a meaningful reason", () => {
    expect(
      createRefundInput.safeParse({
        idempotencyKey: "payment-refund-key-0001",
        amountRials: "0",
        reason: "short",
      }).success,
    ).toBe(false);
  });

  it("rejects malformed callback evidence", () => {
    expect(
      paymentCallbackInput.safeParse({
        externalEventId: "event00000001",
        authority: "authority000001",
        signature: "tiny",
      }).success,
    ).toBe(false);
    expect(
      paymentCallbackInput.safeParse({
        externalEventId: "event00000001",
        authority: "authority000001",
        signature: "z".repeat(64),
      }).success,
    ).toBe(false);
    expect(
      paymentCallbackInput.safeParse({
        externalEventId: "event00000001",
        authority: "authority000001",
        signature: "a".repeat(64),
      }).success,
    ).toBe(true);
  });

  it("rejects inverted admin date and money ranges", () => {
    expect(
      paymentListQuery.safeParse({
        from: "2026-08-11",
        to: "2026-08-10",
      }).success,
    ).toBe(false);
    expect(
      paymentListQuery.safeParse({
        minAmountRials: "2000",
        maxAmountRials: "1000",
      }).success,
    ).toBe(false);
  });
});
