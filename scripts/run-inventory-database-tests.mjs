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
  if (!preflight.ok) throw new Error(`Inventory test environment preflight failed: ${preflight.errors.join(' ')}`);
  const environment = { ...process.env, DATABASE_URL: process.env.INVENTORY_TEST_DATABASE_URL, NODE_ENV: 'test' };
  run(process.execPath, [resolve('scripts/inspect-inventory-test-database.mjs'), '--expect-migrated'], environment);
  run(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.inventory-db.config.ts'], environment);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Inventory database test execution failed.');
  process.exitCode = 1;
}
