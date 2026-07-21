import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { validateInventoryTestEnvironment } from './verify-inventory-test-environment.mjs';

function run(command, argumentsList, environment) {
  const result = spawnSync(command, argumentsList, { cwd: process.cwd(), env: environment, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${argumentsList.join(' ')} failed.`);
}

function main() {
  const preflight = validateInventoryTestEnvironment(process.env);
  if (!preflight.ok) throw new Error(`Inventory E2E environment preflight failed: ${preflight.errors.join(' ')}`);
  if (process.env.APPLE333_E2E_TEST_DB !== '1') {
    throw new Error('Inventory E2E environment preflight failed: APPLE333_E2E_TEST_DB must be exactly "1".');
  }
  const environment = {
    ...process.env,
    DATABASE_URL: process.env.INVENTORY_TEST_DATABASE_URL,
    NODE_ENV: 'test',
  };
  run(process.execPath, [resolve('scripts/inspect-inventory-test-database.mjs'), '--expect-migrated'], environment);
  run(process.execPath, [resolve('scripts/seed-e2e-inventory.mjs')], environment);
  run(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test', 'tests/e2e/phase-06-inventory.spec.ts'], environment);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Inventory E2E test execution failed.');
  process.exitCode = 1;
}
