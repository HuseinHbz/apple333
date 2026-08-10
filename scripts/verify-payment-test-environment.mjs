import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_PAYMENT_TEST_DATABASE = "apple333_phase08_payment_test";
export const EXPECTED_PAYMENT_TEST_USER = "apple333_phase08_payment_test";
export const EXPECTED_PAYMENT_TEST_PORT = "55435";

const required = Object.freeze([
  ["NODE_ENV", "test"],
  ["APPLE333_TEST_DB", "1"],
  ["APPLE333_PAYMENT_TEST_DB", "1"],
]);

export function validatePaymentTestEnvironment(environment = process.env) {
  const errors = [];
  for (const [key, expected] of required) {
    if (environment[key] !== expected)
      errors.push(`${key} must be exactly "${expected}".`);
  }
  const databaseUrl = environment.PAYMENT_TEST_DATABASE_URL;
  if (!databaseUrl) {
    errors.push("PAYMENT_TEST_DATABASE_URL is required.");
    return { ok: false, errors };
  }
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    errors.push("PAYMENT_TEST_DATABASE_URL must be a valid PostgreSQL URL.");
    return { ok: false, errors };
  }
  if (parsed.protocol !== "postgresql:")
    errors.push("PAYMENT_TEST_DATABASE_URL must use postgresql:.");
  if (parsed.hostname !== "127.0.0.1")
    errors.push("Payment test database host must be literal 127.0.0.1.");
  if (parsed.port !== EXPECTED_PAYMENT_TEST_PORT)
    errors.push(
      `Payment test database must use port ${EXPECTED_PAYMENT_TEST_PORT}.`,
    );
  if (parsed.username !== EXPECTED_PAYMENT_TEST_USER)
    errors.push(
      `Payment test database role must be ${EXPECTED_PAYMENT_TEST_USER}.`,
    );
  if (
    decodeURIComponent(parsed.pathname) !== `/${EXPECTED_PAYMENT_TEST_DATABASE}`
  )
    errors.push(
      `Payment test database must be /${EXPECTED_PAYMENT_TEST_DATABASE}.`,
    );
  if (parsed.searchParams.get("schema") !== "public")
    errors.push("Payment test database must use schema=public.");
  if (!parsed.password)
    errors.push("Payment test database password is required.");
  if (environment.DATABASE_URL && environment.DATABASE_URL !== databaseUrl)
    errors.push(
      "DATABASE_URL must be unset or equal PAYMENT_TEST_DATABASE_URL.",
    );

  const redisUrl = environment.PAYMENT_TEST_REDIS_URL;
  if (!redisUrl) errors.push("PAYMENT_TEST_REDIS_URL is required.");
  else {
    try {
      const redis = new URL(redisUrl);
      if (
        redis.protocol !== "redis:" ||
        redis.hostname !== "127.0.0.1" ||
        redis.port !== "56380" ||
        redis.pathname !== "/8"
      ) {
        errors.push(
          "Redis must be the dedicated loopback Phase 08 database 8 target.",
        );
      }
    } catch {
      errors.push("PAYMENT_TEST_REDIS_URL must be a valid Redis URL.");
    }
  }
  const simulatorUrl = environment.PAYMENT_SIMULATOR_URL;
  if (!simulatorUrl) errors.push("PAYMENT_SIMULATOR_URL is required.");
  else {
    try {
      const simulator = new URL(simulatorUrl);
      if (simulator.origin !== "http://127.0.0.1:58080")
        errors.push("Simulator must use dedicated loopback port 58080.");
    } catch {
      errors.push("PAYMENT_SIMULATOR_URL must be a valid URL.");
    }
  }
  if ((environment.PAYMENT_SIMULATOR_SECRET ?? "").length < 32)
    errors.push(
      "PAYMENT_SIMULATOR_SECRET must contain at least 32 characters.",
    );
  for (const key of Object.keys(environment)) {
    if (/PRODUCTION.*(PAYMENT|GATEWAY)|PAYMENT.*PRODUCTION/i.test(key))
      errors.push(
        `Production payment setting ${key} is forbidden in Phase 08 tests.`,
      );
  }
  return { ok: errors.length === 0, errors };
}

function isDirectExecution() {
  return (
    Boolean(process.argv[1]) &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}

if (isDirectExecution()) {
  const result = validatePaymentTestEnvironment();
  if (result.ok)
    console.log("Payment test preflight passed without opening a connection.");
  else {
    console.error("Payment test preflight failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
}
