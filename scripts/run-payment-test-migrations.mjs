import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { validatePaymentTestEnvironment } from "./verify-payment-test-environment.mjs";

function run(argumentsList, environment) {
  const result = spawnSync(process.execPath, argumentsList, {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Command failed: ${argumentsList.join(" ")}`);
}

function check(argumentsList, environment) {
  return spawnSync(process.execPath, argumentsList, {
    cwd: process.cwd(),
    env: environment,
    encoding: "utf8",
  });
}

const preflight = validatePaymentTestEnvironment(process.env);
if (!preflight.ok) throw new Error(preflight.errors.join(" "));
const environment = {
  ...process.env,
  DATABASE_URL: process.env.PAYMENT_TEST_DATABASE_URL,
  NODE_ENV: "test",
};
const inspect = resolve("scripts/inspect-payment-test-database.mjs");
const prismaCli = resolve("node_modules/prisma/build/index.js");
const empty = check([inspect, "--expect-empty"], environment);
if (empty.status !== 0) {
  const owned = check([inspect, "--expect-migrated"], environment);
  if (owned.status !== 0) {
    throw new Error(
      "Refusing migration: schema is neither empty nor an already migrated Phase 08 project database.",
    );
  }
  console.log(
    "Existing Phase 08 schema verified; already applied migrations will be skipped.",
  );
} else {
  console.log("Empty Phase 08 schema verified before first migration.");
}
run([prismaCli, "migrate", "deploy"], environment);
run([inspect, "--expect-migrated"], environment);
run([prismaCli, "migrate", "status"], environment);
