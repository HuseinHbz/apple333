import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateOrderTestEnvironment } from "./verify-order-test-environment.mjs";

export const ORDER_DATABASE_TEST_FILES = Object.freeze([
  "tests/database/order-persistence.test.ts",
  "tests/database/order-concurrency.test.ts",
]);

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

function main() {
  const preflight = validateOrderTestEnvironment(process.env);
  if (!preflight.ok) {
    throw new Error(
      `Order test environment preflight failed: ${preflight.errors.join(" ")}`,
    );
  }

  const missingTests = ORDER_DATABASE_TEST_FILES.filter(
    (testFile) => !existsSync(resolve(testFile)),
  );
  if (missingTests.length > 0) {
    throw new Error(
      `Order database tests are incomplete; missing: ${missingTests.join(", ")}.`,
    );
  }

  const environment = {
    ...process.env,
    DATABASE_URL: process.env.ORDER_TEST_DATABASE_URL,
    NODE_ENV: "test",
  };
  run(
    process.execPath,
    [resolve("scripts/inspect-order-test-database.mjs"), "--expect-migrated"],
    environment,
  );
  run(
    process.execPath,
    [
      resolve("node_modules/vitest/vitest.mjs"),
      "run",
      "--config",
      "vitest.order-db.config.ts",
    ],
    environment,
  );
}

const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Order database test execution failed.",
    );
    process.exitCode = 1;
  }
}
