import { describe, expect, it } from "vitest";

import {
  paymentPayloadHash,
  paymentRequestHash,
  stablePaymentSerialize,
} from "@/modules/payments/idempotency";

describe("Phase 08 payment idempotency", () => {
  it("produces the same hash for semantically identical object key order", () => {
    expect(paymentRequestHash({ a: 1, b: "2" })).toBe(
      paymentRequestHash({ b: "2", a: 1 }),
    );
    expect(stablePaymentSerialize({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it("changes the request hash when a money-bearing payload changes", () => {
    expect(paymentRequestHash({ amount: "100" })).not.toBe(
      paymentRequestHash({ amount: "101" }),
    );
  });

  it("stores only a deterministic SHA-256 callback evidence hash", () => {
    expect(paymentPayloadHash("callback")).toMatch(/^[0-9a-f]{64}$/);
  });
});
