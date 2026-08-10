import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { validatePaymentTestEnvironment } from "./verify-payment-test-environment.mjs";

const files = [
  "tests/database/payment-persistence.test.ts",
  "tests/database/payment-concurrency.test.ts",
];
const preflight = validatePaymentTestEnvironment(process.env);
if (!preflight.ok) throw new Error(preflight.errors.join(" "));
for (const file of files)
  if (!existsSync(resolve(file))) throw new Error(`Missing ${file}.`);
const environment = {
  ...process.env,
  DATABASE_URL: process.env.PAYMENT_TEST_DATABASE_URL,
  NODE_ENV: "test",
  APP_URL: "http://127.0.0.1:3000",
};
for (const argumentsList of [
  [resolve("scripts/inspect-payment-test-database.mjs"), "--expect-migrated"],
  [
    resolve("node_modules/vitest/vitest.mjs"),
    "run",
    "--config",
    "vitest.payment-db.config.ts",
  ],
]) {
  const result = spawnSync(process.execPath, argumentsList, {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Command failed: ${argumentsList.join(" ")}`);
}
