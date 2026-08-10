import { describe, expect, it } from "vitest";

import { findPaymentDifference } from "@/modules/payments/reconciliation";

const baseline = {
  internalStatus: "PAID" as const,
  internalAmountRials: 1_000n,
  internalCurrency: "IRR",
  capturedRefundRials: 0n,
  expectedRefundRials: 0n,
  provider: {
    status: "PAID" as const,
    amountRials: 1_000n,
    currency: "IRR",
    providerReference: "REF-1",
  },
  orderExists: true,
  duplicateProviderReference: false,
  hasUnprocessedCallback: false,
};

describe("Phase 08 reconciliation rules", () => {
  it("reports zero drift for matching internal and provider state", () => {
    expect(findPaymentDifference(baseline)).toBe("NONE");
  });

  it("prioritizes money and currency mismatches", () => {
    expect(
      findPaymentDifference({
        ...baseline,
        provider: { ...baseline.provider, amountRials: 999n },
      }),
    ).toBe("AMOUNT_MISMATCH");
    expect(
      findPaymentDifference({
        ...baseline,
        provider: { ...baseline.provider, currency: "USD" },
      }),
    ).toBe("CURRENCY_MISMATCH");
  });

  it("detects provider/internal paid-state drift and refund drift", () => {
    expect(
      findPaymentDifference({
        ...baseline,
        internalStatus: "PENDING",
      }),
    ).toBe("PROVIDER_PAID_INTERNAL_NOT_PAID");
    expect(
      findPaymentDifference({ ...baseline, expectedRefundRials: 10n }),
    ).toBe("REFUND_MISMATCH");
  });
});
