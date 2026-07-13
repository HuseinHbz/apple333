import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const rootDirectory = dirname(fileURLToPath(import.meta.url));

/**
 * Database-backed PIM tests are deliberately isolated from the default Vitest
 * suite. They must be invoked only through the Phase 04.1 guarded test
 * command against the disposable apple333_pim_test database.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/database/**/*.test.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
  resolve: { alias: { '@': resolve(rootDirectory, './src') } },
});
