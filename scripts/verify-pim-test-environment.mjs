import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPECTED_PIM_TEST_DATABASE = 'apple333_pim_test';
export const EXPECTED_PIM_TEST_USER = 'apple333_pim_test';
export const EXPECTED_PIM_TEST_PORT = '55432';
export const ALLOWED_PIM_TEST_HOSTS = new Set(['127.0.0.1']);

/**
 * Validates only strings in the supplied environment. It deliberately does not
 * import a database client, spawn a process, or make a network connection.
 *
 * @param {NodeJS.ProcessEnv} environment
 * @returns {{ ok: boolean; errors: string[] }}
 */
export function validatePimTestEnvironment(environment = process.env) {
  const errors = [];

  if (environment.NODE_ENV !== 'test') {
    errors.push('NODE_ENV must be exactly "test".');
  }

  if (environment.APPLE333_PIM_TEST_DB !== '1') {
    errors.push('APPLE333_PIM_TEST_DB must be exactly "1".');
  }

  const databaseUrl = environment.PIM_TEST_DATABASE_URL;
  if (!databaseUrl) {
    errors.push('PIM_TEST_DATABASE_URL is required.');
    return { ok: false, errors };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    errors.push('PIM_TEST_DATABASE_URL must be a valid PostgreSQL URL.');
    return { ok: false, errors };
  }

  if (parsedUrl.protocol !== 'postgresql:') {
    errors.push('PIM_TEST_DATABASE_URL must use the postgresql: scheme.');
  }

  if (parsedUrl.username !== EXPECTED_PIM_TEST_USER) {
    errors.push(`PIM_TEST_DATABASE_URL must use the ${EXPECTED_PIM_TEST_USER} role.`);
  }

  if (!parsedUrl.password) {
    errors.push('PIM_TEST_DATABASE_URL must include a non-empty password.');
  }

  if (!ALLOWED_PIM_TEST_HOSTS.has(parsedUrl.hostname)) {
    errors.push('PIM_TEST_DATABASE_URL host must be a loopback address.');
  }

  if (parsedUrl.port !== EXPECTED_PIM_TEST_PORT) {
    errors.push(`PIM_TEST_DATABASE_URL must use dedicated port ${EXPECTED_PIM_TEST_PORT}.`);
  }

  if (decodeURIComponent(parsedUrl.pathname) !== `/${EXPECTED_PIM_TEST_DATABASE}`) {
    errors.push(`PIM_TEST_DATABASE_URL must target /${EXPECTED_PIM_TEST_DATABASE}.`);
  }

  if (parsedUrl.searchParams.getAll('schema').length !== 1 || parsedUrl.searchParams.get('schema') !== 'public') {
    errors.push('PIM_TEST_DATABASE_URL must contain exactly one schema=public parameter.');
  }

  if (parsedUrl.hash) {
    errors.push('PIM_TEST_DATABASE_URL must not contain a URL fragment.');
  }

  return { ok: errors.length === 0, errors };
}

function isDirectExecution() {
  const invokedPath = process.argv[1];
  return Boolean(invokedPath) && resolve(invokedPath) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  const result = validatePimTestEnvironment();

  if (result.ok) {
    console.log('PIM test environment preflight passed. No database connection was attempted.');
  } else {
    console.error('PIM test environment preflight failed:');
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  }
}
