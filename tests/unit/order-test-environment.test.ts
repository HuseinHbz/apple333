import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EXPECTED_ORDER_TEST_DATABASE,
  EXPECTED_ORDER_TEST_PORT,
  EXPECTED_ORDER_TEST_USER,
  validateOrderTestEnvironment,
} from "../../scripts/verify-order-test-environment.mjs";
import {
  createOrderE2eRuntimeEnvironment,
  resolveOrderE2eRuntimeEndpoint,
  shouldManageOrderE2eServer,
  validateOrderE2eEnvironment,
} from "../../scripts/run-order-e2e-tests.mjs";
import { PHASE_07_ORDER_MIGRATION } from "../../scripts/inspect-order-test-database.mjs";
import { ORDER_DATABASE_TEST_FILES } from "../../scripts/run-order-database-tests.mjs";

const testDatabaseUrl =
  "postgresql://apple333_phase07_order_test:local-test-password@127.0.0.1:55434/apple333_phase07_order_test?schema=public";

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    APPLE333_TEST_DB: "1",
    APPLE333_ORDER_TEST_DB: "1",
    ORDER_TEST_DATABASE_URL: testDatabaseUrl,
  };
}

describe("Phase 07 isolated order test environment guards", () => {
  it("accepts only the dedicated loopback order database without connecting", () => {
    expect(validateOrderTestEnvironment(validEnvironment())).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("requires all explicit test acknowledgements", () => {
    const result = validateOrderTestEnvironment({
      ...validEnvironment(),
      NODE_ENV: "development",
      APPLE333_TEST_DB: "true",
      APPLE333_ORDER_TEST_DB: "0",
    });

    expect(result).toEqual(expect.objectContaining({ ok: false }));
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'NODE_ENV must be exactly "test".',
        'APPLE333_TEST_DB must be exactly "1".',
        'APPLE333_ORDER_TEST_DB must be exactly "1".',
      ]),
    );
  });

  it("rejects non-loopback, non-owned, default-port, and foreign-schema URLs", () => {
    const result = validateOrderTestEnvironment({
      ...validEnvironment(),
      ORDER_TEST_DATABASE_URL:
        "postgresql://other:password@production.example:5432/apple333_production?schema=private",
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        `ORDER_TEST_DATABASE_URL must use the ${EXPECTED_ORDER_TEST_USER} role.`,
        "ORDER_TEST_DATABASE_URL host must be exactly 127.0.0.1.",
        `ORDER_TEST_DATABASE_URL must use dedicated port ${EXPECTED_ORDER_TEST_PORT}.`,
        `ORDER_TEST_DATABASE_URL must target /${EXPECTED_ORDER_TEST_DATABASE}.`,
        "ORDER_TEST_DATABASE_URL must contain exactly one schema=public parameter.",
      ]),
    );
  });

  it("rejects localhost and a mismatched ambient DATABASE_URL to prevent DNS or inheritance bypasses", () => {
    const result = validateOrderTestEnvironment({
      ...validEnvironment(),
      ORDER_TEST_DATABASE_URL:
        "postgresql://apple333_phase07_order_test:password@localhost:55434/apple333_phase07_order_test?schema=public",
      DATABASE_URL: testDatabaseUrl,
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "ORDER_TEST_DATABASE_URL host must be exactly 127.0.0.1.",
        "DATABASE_URL must be unset or exactly match ORDER_TEST_DATABASE_URL.",
      ]),
    );
  });

  it("allows optional identity assertions only when they preserve the owned target", () => {
    expect(
      validateOrderTestEnvironment({
        ...validEnvironment(),
        ORDER_TEST_POSTGRES_DB: EXPECTED_ORDER_TEST_DATABASE,
        ORDER_TEST_POSTGRES_USER: EXPECTED_ORDER_TEST_USER,
        ORDER_TEST_POSTGRES_BIND: "127.0.0.1",
        ORDER_TEST_POSTGRES_PORT: EXPECTED_ORDER_TEST_PORT,
        DATABASE_URL: testDatabaseUrl,
      }),
    ).toEqual({ ok: true, errors: [] });

    expect(
      validateOrderTestEnvironment({
        ...validEnvironment(),
        ORDER_TEST_POSTGRES_DB: "apple333_shared_test",
        ORDER_TEST_POSTGRES_PORT: "5432",
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        `ORDER_TEST_POSTGRES_DB, when set, must be exactly "${EXPECTED_ORDER_TEST_DATABASE}".`,
        `ORDER_TEST_POSTGRES_PORT, when set, must be exactly "${EXPECTED_ORDER_TEST_PORT}".`,
      ]),
    );
  });

  it("declares a labeled, loopback-only, disposable PostgreSQL resource owned by Phase 07", () => {
    const environmentTemplate = readFileSync(
      resolve(".env.order-test.example"),
      "utf8",
    );
    const compose = readFileSync(
      resolve("docker-compose.order-test.yml"),
      "utf8",
    );

    expect(environmentTemplate).toContain("NODE_ENV=test");
    expect(environmentTemplate).toContain("APPLE333_TEST_DB=1");
    expect(environmentTemplate).toContain("APPLE333_ORDER_TEST_DB=1");
    expect(environmentTemplate).toContain("APPLE333_ORDER_E2E_TEST_DB=1");
    expect(environmentTemplate).toContain(
      `ORDER_TEST_DATABASE_URL=${testDatabaseUrl.replace("local-test-password", "local-test-only-change-me")}`,
    );
    expect(compose).toContain("apple333-phase07-order-postgres:");
    expect(compose).toContain(
      "container_name: apple333-phase07-order-postgres",
    );
    expect(compose).toContain(`POSTGRES_DB: ${EXPECTED_ORDER_TEST_DATABASE}`);
    expect(compose).toContain(`POSTGRES_USER: ${EXPECTED_ORDER_TEST_USER}`);
    expect(compose).toContain("127.0.0.1:55434:5432");
    expect(compose).not.toContain(":5432:5432");
    expect(compose).toContain("driver: bridge");
    expect(compose).not.toContain("internal: true");
    expect(compose).toContain("com.apple333.owner: phase-07");
    expect(compose).toContain('com.apple333.disposable: "true"');
    expect(compose).toContain("healthcheck:");
  });

  it("pins the Phase 07 migration marker and both required real-database suites", () => {
    expect(PHASE_07_ORDER_MIGRATION).toBe(
      "20260729000000_phase_07_order_management",
    );
    expect(ORDER_DATABASE_TEST_FILES).toEqual([
      "tests/database/order-persistence.test.ts",
      "tests/database/order-concurrency.test.ts",
    ]);
  });

  it("permits the HTTP cookie exception only in the explicitly guarded loopback E2E runtime", () => {
    const environment = {
      ...validEnvironment(),
      APPLE333_ORDER_E2E_TEST_DB: "1",
    };
    expect(validateOrderE2eEnvironment(environment)).toEqual({
      ok: true,
      errors: [],
    });

    const runtime = createOrderE2eRuntimeEnvironment(environment);
    expect(runtime.NODE_ENV).toBe("production");
    expect(runtime.APPLE333_E2E_RUNTIME_EVIDENCE).toBe("1");
    expect("APPLE333_ORDER_E2E_RUNTIME_EVIDENCE" in environment).toBe(false);
    expect(runtime.DATABASE_URL).toBe(testDatabaseUrl);
  });

  it("supports a validated alternative loopback port for Windows local evidence", () => {
    const environment = {
      ...validEnvironment(),
      APPLE333_ORDER_E2E_TEST_DB: "1",
      APPLE333_E2E_PORT: "3800",
      ORDER_E2E_BASE_URL: "http://127.0.0.1:3800",
      APP_URL: "http://127.0.0.1:3800",
      AUTH_URL: "http://127.0.0.1:3800",
      NEXTAUTH_URL: "http://127.0.0.1:3800",
    };

    expect(resolveOrderE2eRuntimeEndpoint(environment)).toEqual({
      ok: true,
      port: "3800",
      baseUrl: "http://127.0.0.1:3800",
    });
    expect(validateOrderE2eEnvironment(environment)).toEqual({
      ok: true,
      errors: [],
    });
    expect(createOrderE2eRuntimeEnvironment(environment)).toMatchObject({
      PORT: "3800",
      APPLE333_E2E_PORT: "3800",
      APP_URL: "http://127.0.0.1:3800",
    });
  });

  it("fails closed when an E2E port is malformed or out of range", () => {
    expect(
      resolveOrderE2eRuntimeEndpoint({
        ...validEnvironment(),
        APPLE333_E2E_PORT: "0",
      }),
    ).toEqual({
      ok: false,
      error: "APPLE333_E2E_PORT must be a TCP port between 1 and 65535.",
    });
    expect(
      validateOrderE2eEnvironment({
        ...validEnvironment(),
        APPLE333_ORDER_E2E_TEST_DB: "1",
        APPLE333_E2E_PORT: "70000",
      }).errors,
    ).toContain("APPLE333_E2E_PORT must be a TCP port between 1 and 65535.");
  });

  it("owns the standalone server lifecycle on Windows without exposing the reuse marker", () => {
    expect(shouldManageOrderE2eServer("win32")).toBe(true);
    expect(shouldManageOrderE2eServer("linux")).toBe(false);
    expect(
      validateOrderE2eEnvironment({
        ...validEnvironment(),
        APPLE333_ORDER_E2E_TEST_DB: "1",
        APPLE333_E2E_REUSE_EXISTING_SERVER: "1",
      }).errors,
    ).toContain(
      "APPLE333_E2E_REUSE_EXISTING_SERVER is runner-managed and must be unset.",
    );
  });
});
