import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateInventoryTestEnvironment } from './verify-inventory-test-environment.mjs';

export const INVENTORY_TEST_REDIS_URL = 'redis://127.0.0.1:56379';

export function validateInventoryE2eEnvironment(environment = process.env) {
  const preflight = validateInventoryTestEnvironment(environment);
  const errors = [...preflight.errors];
  if (environment.APPLE333_E2E_TEST_DB !== '1') {
    errors.push('APPLE333_E2E_TEST_DB must be exactly "1".');
  }
  if (environment.INVENTORY_TEST_REDIS_URL !== INVENTORY_TEST_REDIS_URL) {
    errors.push(`INVENTORY_TEST_REDIS_URL must be exactly "${INVENTORY_TEST_REDIS_URL}".`);
  }
  if (environment.REDIS_URL !== undefined && environment.REDIS_URL !== INVENTORY_TEST_REDIS_URL) {
    errors.push('REDIS_URL must be unset or exactly match INVENTORY_TEST_REDIS_URL.');
  }
  return { ok: errors.length === 0, errors };
}

function run(command, argumentsList, environment) {
  const result = spawnSync(command, argumentsList, { cwd: process.cwd(), env: environment, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${argumentsList.join(' ')} failed.`);
}

function main() {
  const preflight = validateInventoryE2eEnvironment(process.env);
  if (!preflight.ok) throw new Error(`Inventory E2E environment preflight failed: ${preflight.errors.join(' ')}`);
  const databaseEnvironment = {
    ...process.env,
    DATABASE_URL: process.env.INVENTORY_TEST_DATABASE_URL,
    NODE_ENV: 'test',
  };
  const productionE2eEnvironment = {
    ...databaseEnvironment,
    NODE_ENV: 'production',
    APPLE333_E2E_SERVER_MODE: 'standalone',
    APPLE333_E2E_RUNTIME_EVIDENCE: '1',
    CI: '1',
    HOSTNAME: '127.0.0.1',
    PORT: '3000',
    APP_URL: 'http://127.0.0.1:3000',
    AUTH_URL: 'http://127.0.0.1:3000',
    NEXTAUTH_URL: 'http://127.0.0.1:3000',
    AUTH_SECRET: 'test-only-auth-secret-with-at-least-32-characters',
    NEXTAUTH_SECRET: 'test-only-auth-secret-with-at-least-32-characters',
    REDIS_URL: INVENTORY_TEST_REDIS_URL,
  };
  if (!existsSync(resolve('.next/standalone/server.js'))) {
    throw new Error('Inventory E2E runtime evidence requires a completed production standalone build at .next/standalone/server.js.');
  }
  run(process.execPath, [resolve('scripts/inspect-inventory-test-database.mjs'), '--expect-migrated'], databaseEnvironment);
  run(process.execPath, [resolve('scripts/seed-e2e-inventory.mjs')], databaseEnvironment);
  run(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test', 'tests/e2e/phase-06-inventory.spec.ts'], productionE2eEnvironment);
}

const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Inventory E2E test execution failed.');
    process.exitCode = 1;
  }
}
