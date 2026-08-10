import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { validateOrderTestEnvironment } from "./verify-order-test-environment.mjs";

export const DEFAULT_ORDER_E2E_PORT = "3000";
export const ORDER_E2E_BASE_URL = `http://127.0.0.1:${DEFAULT_ORDER_E2E_PORT}`;
const EXTERNAL_SERVER_MARKER = "APPLE333_E2E_REUSE_EXISTING_SERVER";

export function resolveOrderE2eRuntimeEndpoint(environment = process.env) {
  const port = environment.APPLE333_E2E_PORT ?? DEFAULT_ORDER_E2E_PORT;

  if (!/^[1-9]\d{0,4}$/.test(port) || Number(port) > 65_535) {
    return {
      ok: false,
      error: "APPLE333_E2E_PORT must be a TCP port between 1 and 65535.",
    };
  }

  return {
    ok: true,
    port,
    baseUrl: `http://127.0.0.1:${port}`,
  };
}

export function validateOrderE2eEnvironment(environment = process.env) {
  const preflight = validateOrderTestEnvironment(environment);
  const errors = [...preflight.errors];
  const endpoint = resolveOrderE2eRuntimeEndpoint(environment);
  if (environment.APPLE333_ORDER_E2E_TEST_DB !== "1") {
    errors.push('APPLE333_ORDER_E2E_TEST_DB must be exactly "1".');
  }
  if (environment[EXTERNAL_SERVER_MARKER] !== undefined) {
    errors.push(
      `${EXTERNAL_SERVER_MARKER} is runner-managed and must be unset.`,
    );
  }
  if (!endpoint.ok) {
    errors.push(endpoint.error);
    return { ok: false, errors };
  }
  for (const key of [
    "ORDER_E2E_BASE_URL",
    "APP_URL",
    "AUTH_URL",
    "NEXTAUTH_URL",
  ]) {
    if (
      environment[key] !== undefined &&
      environment[key] !== endpoint.baseUrl
    ) {
      errors.push(`${key} must be unset or exactly "${endpoint.baseUrl}".`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * The production artifact is deliberately served over loopback HTTP during
 * browser evidence.  `APPLE333_E2E_RUNTIME_EVIDENCE` is paired with the
 * disposable-database marker validated above; it is the only condition that
 * permits the auth layer to use a non-Secure cookie in this test-only process.
 */
export function createOrderE2eRuntimeEnvironment(environment = process.env) {
  const endpoint = resolveOrderE2eRuntimeEndpoint(environment);
  if (!endpoint.ok) {
    throw new Error(endpoint.error);
  }

  return {
    ...environment,
    DATABASE_URL: environment.ORDER_TEST_DATABASE_URL,
    NODE_ENV: "production",
    APPLE333_E2E_SERVER_MODE: "standalone",
    APPLE333_E2E_RUNTIME_EVIDENCE: "1",
    CI: "1",
    HOSTNAME: "127.0.0.1",
    PORT: endpoint.port,
    APPLE333_E2E_PORT: endpoint.port,
    ORDER_E2E_BASE_URL: endpoint.baseUrl,
    APP_URL: endpoint.baseUrl,
    AUTH_URL: endpoint.baseUrl,
    NEXTAUTH_URL: endpoint.baseUrl,
    AUTH_SECRET: "phase07-order-e2e-test-only-secret-not-valid-outside-ci",
    NEXTAUTH_SECRET: "phase07-order-e2e-test-only-secret-not-valid-outside-ci",
  };
}

function run(command, argumentsList, environment) {
  const result = spawnSync(command, argumentsList, {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} ${argumentsList.join(" ")} failed.`);
}

export function shouldManageOrderE2eServer(platform = process.platform) {
  return platform === "win32";
}

async function waitForServer(child, baseUrl) {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `Phase 07 E2E server exited before becoming ready (code ${child.exitCode}, signal ${child.signalCode}).`,
      );
    }

    try {
      const response = await fetch(baseUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(2_000),
      });
      await response.body?.cancel();
      return;
    } catch {
      await delay(250);
    }
  }

  throw new Error(`Phase 07 E2E server did not become ready at ${baseUrl}.`);
}

async function waitForExit(child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (
    child.exitCode === null &&
    child.signalCode === null &&
    Date.now() < deadline
  ) {
    await delay(100);
  }
  return child.exitCode !== null || child.signalCode !== null;
}

async function stopOwnedServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  child.kill();
  if (await waitForExit(child, 2_000)) return;

  if (process.platform === "win32" && child.pid) {
    const result = spawnSync(
      "taskkill",
      ["/pid", String(child.pid), "/T", "/F"],
      { stdio: "ignore", windowsHide: true },
    );
    if (result.error) throw result.error;
  } else {
    child.kill("SIGKILL");
  }

  if (!(await waitForExit(child, 5_000))) {
    throw new Error("Phase 07 E2E server could not be stopped safely.");
  }
}

function runPlaywright(environment) {
  run(
    process.execPath,
    [
      resolve("node_modules/@playwright/test/cli.js"),
      "test",
      "tests/e2e/phase-07-orders.spec.ts",
    ],
    environment,
  );
}

async function runPlaywrightWithOwnedWindowsServer(environment) {
  const endpoint = resolveOrderE2eRuntimeEndpoint(environment);
  if (!endpoint.ok) throw new Error(endpoint.error);

  const externalServerEnvironment = {
    ...environment,
    [EXTERNAL_SERVER_MARKER]: "1",
  };
  const server = spawn(
    process.execPath,
    [resolve(".next/standalone/server.js")],
    {
      cwd: process.cwd(),
      env: externalServerEnvironment,
      stdio: "inherit",
      windowsHide: true,
    },
  );

  try {
    await waitForServer(server, endpoint.baseUrl);
    runPlaywright(externalServerEnvironment);
  } finally {
    await stopOwnedServer(server);
  }
}

async function main() {
  const preflight = validateOrderE2eEnvironment(process.env);
  if (!preflight.ok)
    throw new Error(
      `Order E2E environment preflight failed: ${preflight.errors.join(" ")}`,
    );
  if (!existsSync(resolve(".next/standalone/server.js"))) {
    throw new Error(
      "Order E2E runtime evidence requires a completed production standalone build at .next/standalone/server.js.",
    );
  }

  const databaseEnvironment = {
    ...process.env,
    DATABASE_URL: process.env.ORDER_TEST_DATABASE_URL,
    NODE_ENV: "test",
  };
  const productionE2eEnvironment =
    createOrderE2eRuntimeEnvironment(databaseEnvironment);

  run(
    process.execPath,
    [resolve("scripts/inspect-order-test-database.mjs"), "--expect-migrated"],
    databaseEnvironment,
  );
  run(
    process.execPath,
    [resolve("scripts/seed-e2e-orders.mjs")],
    databaseEnvironment,
  );
  if (shouldManageOrderE2eServer()) {
    await runPlaywrightWithOwnedWindowsServer(productionE2eEnvironment);
  } else {
    runPlaywright(productionE2eEnvironment);
  }
}

const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Order E2E test execution failed.",
    );
    process.exitCode = 1;
  });
}
