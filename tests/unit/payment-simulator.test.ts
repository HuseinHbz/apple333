import { describe, expect, it } from "vitest";

import { PaymentProviderError } from "@/modules/payments/provider";
import { PaymentSimulatorProvider } from "@/modules/payments/simulator-provider";
import type { PaymentSimulatorScenario } from "@/modules/payments/types";

const provider = new PaymentSimulatorProvider(
  "phase08-unit-test-secret-with-32-characters",
  "http://127.0.0.1:3000",
);

async function initialize(scenario: PaymentSimulatorScenario) {
  return provider.initializePayment({
    paymentId: "payment00000001",
    paymentNumber: "PAY-TEST-1",
    amountRials: 1_000n,
    currency: "IRR",
    returnUrl: "http://127.0.0.1:3000/return",
    idempotencyKey: "simulator-test-key-0001",
    scenario,
  });
}

describe("Phase 08 deterministic payment simulator", () => {
  it("initializes and verifies a successful provider payment", async () => {
    const initialized = await initialize("success");
    expect(initialized.status).toBe("PENDING");
    const verified = await provider.verifyPayment({
      authority: initialized.authority,
      expectedAmountRials: 1_000n,
      expectedCurrency: "IRR",
    });
    expect(verified.status).toBe("PAID");
    expect(verified.amountRials).toBe(1_000n);
    expect(verified.reference).toMatch(/^REF-/);
  });

  it("returns a mismatched amount only for the explicit negative scenario", async () => {
    const initialized = await initialize("wrong_amount");
    const verified = await provider.verifyPayment({
      authority: initialized.authority,
      expectedAmountRials: 1_000n,
      expectedCurrency: "IRR",
    });
    expect(verified.amountRials).toBe(1_001n);
  });

  it.each([
    ["cancelled", "CANCELLED"],
    ["declined", "FAILED"],
    ["expired", "EXPIRED"],
  ] as const)("maps the %s scenario to %s", async (scenario, expected) => {
    const initialized = await initialize(scenario);
    await expect(
      provider.verifyPayment({
        authority: initialized.authority,
        expectedAmountRials: 1_000n,
        expectedCurrency: "IRR",
      }),
    ).resolves.toMatchObject({ status: expected });
  });

  it("maps timeouts to a canonical retryable provider error", async () => {
    await expect(initialize("timeout")).rejects.toMatchObject({
      code: "PROVIDER_TIMEOUT",
      retryable: true,
    } satisfies Partial<PaymentProviderError>);
  });

  it("maps bounded network retries and unknown authorities to canonical errors", async () => {
    await expect(initialize("network_retry")).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      retryable: true,
    });
    await expect(
      provider.verifyPayment({
        authority: "not-a-simulator-authority",
        expectedAmountRials: 1_000n,
        expectedCurrency: "IRR",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_UNKNOWN_AUTHORITY",
      retryable: false,
    });
  });

  it("supports deterministic refund success and failure", async () => {
    const request = {
      authority: "SIM-success-payment-1000-IRR",
      paymentReference: "REF-TEST",
      amountRials: 500n,
      idempotencyKey: "refund-test-key-0001",
    };
    await expect(
      provider.refundPaymentWhenSupported({
        ...request,
        scenario: "refund_success",
      }),
    ).resolves.toMatchObject({
      succeeded: true,
      providerCode: "SIMULATED_REFUND_SUCCESS",
    });
    await expect(
      provider.refundPaymentWhenSupported({
        ...request,
        scenario: "refund_failure",
      }),
    ).resolves.toMatchObject({
      succeeded: false,
      providerCode: "SIMULATED_REFUND_FAILED",
    });
  });

  it("validates callback signatures with constant-time comparison", async () => {
    const rawPayload = "event:authority:success";
    const signature = provider.signCallback(rawPayload);
    await expect(
      provider.validateCallback({
        rawPayload,
        externalEventId: "event0001",
        authority: "authority0001",
        signature,
      }),
    ).resolves.toBe(true);
    await expect(
      provider.validateCallback({
        rawPayload,
        externalEventId: "event0001",
        authority: "authority0001",
        signature: "0".repeat(64),
      }),
    ).resolves.toBe(false);
  });
});
