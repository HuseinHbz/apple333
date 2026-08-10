/**
 * The Phase 08 simulator is never a production provider. The only exception
 * lets Playwright exercise the production standalone artifact against the
 * exact disposable Phase 08 database and explicit runtime evidence marker.
 */
export function isPaymentSimulatorRuntimeAllowed(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  if (environment.NODE_ENV !== "production") return true;
  if (
    environment.APPLE333_TEST_DB !== "1" ||
    environment.APPLE333_PAYMENT_TEST_DB !== "1" ||
    environment.APPLE333_PAYMENT_E2E_TEST_DB !== "1" ||
    environment.APPLE333_E2E_RUNTIME_EVIDENCE !== "1"
  ) {
    return false;
  }
  try {
    const database = new URL(environment.DATABASE_URL ?? "");
    return (
      ["127.0.0.1", "localhost", "postgres"].includes(database.hostname) &&
      database.pathname === "/apple333_phase08_payment_test"
    );
  } catch {
    return false;
  }
}
