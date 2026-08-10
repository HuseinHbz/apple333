import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_ORDER_TEST_DATABASE = "apple333_phase07_order_test";
export const EXPECTED_ORDER_TEST_USER = "apple333_phase07_order_test";
export const EXPECTED_ORDER_TEST_PORT = "55434";
export const ALLOWED_ORDER_TEST_HOSTS = new Set(["127.0.0.1"]);

const REQUIRED_MARKERS = Object.freeze([
  ["NODE_ENV", "test"],
  ["APPLE333_TEST_DB", "1"],
  ["APPLE333_ORDER_TEST_DB", "1"],
]);

const OPTIONAL_IDENTITY_MARKERS = Object.freeze([
  ["ORDER_TEST_POSTGRES_DB", EXPECTED_ORDER_TEST_DATABASE],
  ["ORDER_TEST_POSTGRES_USER", EXPECTED_ORDER_TEST_USER],
  ["ORDER_TEST_POSTGRES_BIND", "127.0.0.1"],
  ["ORDER_TEST_POSTGRES_PORT", EXPECTED_ORDER_TEST_PORT],
]);

function validateOptionalIdentity(environment, key, expectedValue) {
  if (environment[key] !== undefined && environment[key] !== expectedValue) {
    return `${key}, when set, must be exactly "${expectedValue}".`;
  }
  return undefined;
}

/**
 * Validate only supplied strings. This module deliberately does not import
 * Prisma, open a connection, or spawn a process, so unsafe targets are
 * rejected before database-capable code receives a URL.
 *
 * @param {NodeJS.ProcessEnv} environment
 * @returns {{ ok: boolean; errors: string[] }}
 */
export function validateOrderTestEnvironment(environment = process.env) {
  const errors = [];

  for (const [key, expectedValue] of REQUIRED_MARKERS) {
    if (environment[key] !== expectedValue) {
      errors.push(`${key} must be exactly "${expectedValue}".`);
    }
  }

  for (const [key, expectedValue] of OPTIONAL_IDENTITY_MARKERS) {
    const identityError = validateOptionalIdentity(
      environment,
      key,
      expectedValue,
    );
    if (identityError) errors.push(identityError);
  }

  const databaseUrl = environment.ORDER_TEST_DATABASE_URL;
  if (!databaseUrl) {
    errors.push("ORDER_TEST_DATABASE_URL is required.");
    return { ok: false, errors };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    errors.push("ORDER_TEST_DATABASE_URL must be a valid PostgreSQL URL.");
    return { ok: false, errors };
  }

  if (parsedUrl.protocol !== "postgresql:") {
    errors.push("ORDER_TEST_DATABASE_URL must use the postgresql: scheme.");
  }
  if (parsedUrl.username !== EXPECTED_ORDER_TEST_USER) {
    errors.push(
      `ORDER_TEST_DATABASE_URL must use the ${EXPECTED_ORDER_TEST_USER} role.`,
    );
  }
  if (!parsedUrl.password) {
    errors.push("ORDER_TEST_DATABASE_URL must include a non-empty password.");
  }
  if (!ALLOWED_ORDER_TEST_HOSTS.has(parsedUrl.hostname)) {
    errors.push("ORDER_TEST_DATABASE_URL host must be exactly 127.0.0.1.");
  }
  if (parsedUrl.port !== EXPECTED_ORDER_TEST_PORT) {
    errors.push(
      `ORDER_TEST_DATABASE_URL must use dedicated port ${EXPECTED_ORDER_TEST_PORT}.`,
    );
  }
  if (
    decodeURIComponent(parsedUrl.pathname) !==
    `/${EXPECTED_ORDER_TEST_DATABASE}`
  ) {
    errors.push(
      `ORDER_TEST_DATABASE_URL must target /${EXPECTED_ORDER_TEST_DATABASE}.`,
    );
  }
  if (
    parsedUrl.searchParams.getAll("schema").length !== 1 ||
    parsedUrl.searchParams.get("schema") !== "public"
  ) {
    errors.push(
      "ORDER_TEST_DATABASE_URL must contain exactly one schema=public parameter.",
    );
  }
  if (parsedUrl.hash) {
    errors.push("ORDER_TEST_DATABASE_URL must not contain a URL fragment.");
  }
  if (environment.DATABASE_URL && environment.DATABASE_URL !== databaseUrl) {
    errors.push(
      "DATABASE_URL must be unset or exactly match ORDER_TEST_DATABASE_URL.",
    );
  }

  return { ok: errors.length === 0, errors };
}

function isDirectExecution() {
  const invokedPath = process.argv[1];
  return (
    Boolean(invokedPath) &&
    resolve(invokedPath) === fileURLToPath(import.meta.url)
  );
}

if (isDirectExecution()) {
  const result = validateOrderTestEnvironment();
  if (result.ok) {
    console.log(
      "Order test environment preflight passed. No database connection was attempted.",
    );
  } else {
    console.error("Order test environment preflight failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
}
