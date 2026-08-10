import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateOrderTestEnvironment } from "./verify-order-test-environment.mjs";

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

  const environment = {
    ...process.env,
    DATABASE_URL: process.env.ORDER_TEST_DATABASE_URL,
    NODE_ENV: "test",
  };
  const inspectScript = resolve("scripts/inspect-order-test-database.mjs");
  const prismaCli = resolve("node_modules/prisma/build/index.js");

  // Refuse to migrate a retained or foreign schema. The disposable volume must
  // be explicitly recreated by its owner before a new migration proof run.
  run(process.execPath, [inspectScript, "--expect-empty"], environment);
  run(process.execPath, [prismaCli, "migrate", "deploy"], environment);
  run(process.execPath, [inspectScript, "--expect-migrated"], environment);
  run(process.execPath, [prismaCli, "migrate", "status"], environment);
}

const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Order migration execution failed.",
    );
    process.exitCode = 1;
  }
}
