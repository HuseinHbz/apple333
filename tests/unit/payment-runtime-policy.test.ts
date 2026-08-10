import { describe, expect, it } from "vitest";

import { isPaymentSimulatorRuntimeAllowed } from "@/modules/payments/runtime-policy";

const guardedProductionEvidence = {
  NODE_ENV: "production",
  APPLE333_TEST_DB: "1",
  APPLE333_PAYMENT_TEST_DB: "1",
  APPLE333_PAYMENT_E2E_TEST_DB: "1",
  APPLE333_E2E_RUNTIME_EVIDENCE: "1",
  DATABASE_URL:
    "postgresql://payment:test@127.0.0.1:55435/apple333_phase08_payment_test?schema=public",
} satisfies NodeJS.ProcessEnv;

describe("Phase 08 payment simulator runtime policy", () => {
  it("allows non-production development and test runtimes", () => {
    expect(isPaymentSimulatorRuntimeAllowed({ NODE_ENV: "test" })).toBe(true);
    expect(isPaymentSimulatorRuntimeAllowed({ NODE_ENV: "development" })).toBe(
      true,
    );
  });

  it("rejects the simulator in a normal production runtime", () => {
    expect(
      isPaymentSimulatorRuntimeAllowed({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://apple333:secret@postgres/apple333",
      }),
    ).toBe(false);
  });

  it("allows only the exact isolated production-artifact E2E boundary", () => {
    expect(isPaymentSimulatorRuntimeAllowed(guardedProductionEvidence)).toBe(
      true,
    );
    expect(
      isPaymentSimulatorRuntimeAllowed({
        ...guardedProductionEvidence,
        DATABASE_URL:
          "postgresql://payment:test@db.example.com/apple333_phase08_payment_test",
      }),
    ).toBe(false);
    expect(
      isPaymentSimulatorRuntimeAllowed({
        ...guardedProductionEvidence,
        APPLE333_E2E_RUNTIME_EVIDENCE: "0",
      }),
    ).toBe(false);
  });
});
