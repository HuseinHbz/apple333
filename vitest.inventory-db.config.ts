import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const rootDirectory = dirname(fileURLToPath(import.meta.url));

/** Database tests only run through the guarded isolated-inventory command. */
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'tests/database/inventory-persistence.test.ts',
      'tests/database/inventory-concurrency.test.ts',
    ],
    // The suites share one disposable PostgreSQL database. Keep fixture setup
    // deterministic; the concurrency cases themselves still use parallel
    // operations within each test.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
  resolve: { alias: { '@': resolve(rootDirectory, './src') } },
});
