import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDirectory = dirname(fileURLToPath(import.meta.url));

/** Database tests run only through the guarded Phase 07 order-test command. */
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/database/order-persistence.test.ts",
      "tests/database/order-concurrency.test.ts",
    ],
    // The suites share a single disposable PostgreSQL database. Individual
    // tests may still exercise parallel operations inside a transaction.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
  resolve: { alias: { "@": resolve(rootDirectory, "./src") } },
});
