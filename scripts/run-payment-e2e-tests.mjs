import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { PAYMENT_E2E_SECRET } from "./payment-e2e-fixtures.mjs";
import { validatePaymentTestEnvironment } from "./verify-payment-test-environment.mjs";

const preflight = validatePaymentTestEnvironment(process.env);
if (!preflight.ok) throw new Error(preflight.errors.join(" "));
if (process.env.APPLE333_PAYMENT_E2E_TEST_DB !== "1")
  throw new Error("APPLE333_PAYMENT_E2E_TEST_DB must be exactly 1.");
if (!existsSync(resolve(".next/BUILD_ID")))
  throw new Error(
    "A completed production build is required before payment E2E.",
  );

const port = "3002";
const baseUrl = `http://127.0.0.1:${port}`;
const environment = {
  ...process.env,
  DATABASE_URL: process.env.PAYMENT_TEST_DATABASE_URL,
  REDIS_URL: process.env.PAYMENT_TEST_REDIS_URL,
  NODE_ENV: "production",
  CI: "1",
  HOSTNAME: "127.0.0.1",
  PORT: port,
  APPLE333_E2E_PORT: port,
  APPLE333_E2E_REUSE_EXISTING_SERVER: "1",
  APPLE333_E2E_RUNTIME_EVIDENCE: "1",
  APP_URL: baseUrl,
  AUTH_URL: baseUrl,
  NEXTAUTH_URL: baseUrl,
  AUTH_SECRET: "phase08-payment-e2e-auth-secret-at-least-32chars",
  NEXTAUTH_SECRET: "phase08-payment-e2e-auth-secret-at-least-32chars",
  PAYMENT_SIMULATOR_SECRET: PAYMENT_E2E_SECRET,
};

function run(argumentsList, env = environment) {
  const result = spawnSync(process.execPath, argumentsList, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Command failed: ${argumentsList.join(" ")}`);
}

run(
  [resolve("scripts/inspect-payment-test-database.mjs"), "--expect-migrated"],
  { ...environment, NODE_ENV: "test" },
);
run([resolve("scripts/seed-payment-tests.mjs")], {
  ...environment,
  NODE_ENV: "test",
});
run([resolve("scripts/prepare-standalone-runtime.mjs")], environment);

const server = spawn(
  process.execPath,
  [resolve(".next/standalone/server.js")],
  { cwd: process.cwd(), env: environment, stdio: "inherit", windowsHide: true },
);
try {
  const deadline = Date.now() + 120_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (server.exitCode !== null)
      throw new Error("Payment E2E server exited early.");
    try {
      const response = await fetch(baseUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(2_000),
      });
      await response.body?.cancel();
      ready = true;
      break;
    } catch {
      await delay(250);
    }
  }
  if (!ready) throw new Error("Payment E2E server readiness timed out.");
  run([
    resolve("node_modules/@playwright/test/cli.js"),
    "test",
    "tests/e2e/phase-08-payments.spec.ts",
    "--retries=0",
  ]);
} finally {
  if (server.exitCode === null) {
    if (process.platform === "win32" && server.pid)
      spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    else server.kill("SIGTERM");
  }
}
