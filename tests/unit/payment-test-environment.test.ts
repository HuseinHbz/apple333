import { describe, expect, it } from "vitest";

import { validatePaymentTestEnvironment } from "../../scripts/verify-payment-test-environment.mjs";

const safe = {
  NODE_ENV: "test",
  APPLE333_TEST_DB: "1",
  APPLE333_PAYMENT_TEST_DB: "1",
  PAYMENT_TEST_DATABASE_URL:
    "postgresql://apple333_phase08_payment_test:local@127.0.0.1:55435/apple333_phase08_payment_test?schema=public",
  PAYMENT_TEST_REDIS_URL: "redis://127.0.0.1:56380/8",
  PAYMENT_SIMULATOR_URL: "http://127.0.0.1:58080",
  PAYMENT_SIMULATOR_SECRET: "phase08-disposable-secret-with-32-characters",
} satisfies NodeJS.ProcessEnv;

describe("Phase 08 disposable environment guard", () => {
  it("accepts only the dedicated local payment environment", () => {
    expect(validatePaymentTestEnvironment(safe).ok).toBe(true);
  });

  it("rejects production-like database and simulator targets", () => {
    const result = validatePaymentTestEnvironment({
      ...safe,
      PAYMENT_TEST_DATABASE_URL:
        "postgresql://apple333_phase08_payment_test:secret@db.apple333.ir:5432/apple333?schema=public",
      PAYMENT_SIMULATOR_URL: "https://gateway.example",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("127.0.0.1");
  });

  it("rejects any production gateway credential marker", () => {
    const result = validatePaymentTestEnvironment({
      ...safe,
      PRODUCTION_PAYMENT_SECRET: "forbidden",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("forbidden");
  });
});
