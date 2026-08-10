import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateOrderTestEnvironment } from "./verify-order-test-environment.mjs";

/**
 * Produce a deliberately non-secret artifact describing the disposable
 * evidence environment. Passwords, complete URLs, process environment, and
 * customer/device data are never serialized.
 */
export function orderEvidenceMetadata(environment = process.env) {
  const validation = validateOrderTestEnvironment(environment);
  if (!validation.ok)
    throw new Error(
      `Order evidence metadata preflight failed: ${validation.errors.join(" ")}`,
    );
  const database = new URL(environment.ORDER_TEST_DATABASE_URL);
  return {
    phase: "07",
    generatedAt: new Date().toISOString(),
    runtime: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
    },
    testDatabase: {
      protocol: database.protocol,
      host: database.hostname,
      port: database.port,
      database: database.pathname.replace(/^\//, ""),
      role: database.username,
      schema: database.searchParams.get("schema"),
    },
    guards: {
      nodeEnv: environment.NODE_ENV,
      apple333TestDb: environment.APPLE333_TEST_DB,
      apple333OrderTestDb: environment.APPLE333_ORDER_TEST_DB,
      apple333OrderE2eTestDb: environment.APPLE333_ORDER_E2E_TEST_DB === "1",
    },
  };
}

export function writeOrderEvidenceMetadata(
  outputPath,
  environment = process.env,
) {
  if (!outputPath)
    throw new Error(
      "Usage: node scripts/write-order-evidence-metadata.mjs <output-path>",
    );
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(
    resolvedOutput,
    `${JSON.stringify(orderEvidenceMetadata(environment), null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  return resolvedOutput;
}

const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  try {
    console.log(
      `Wrote sanitized Phase 07 evidence metadata: ${writeOrderEvidenceMetadata(process.argv[2])}`,
    );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Could not write Phase 07 evidence metadata.",
    );
    process.exitCode = 1;
  }
}
