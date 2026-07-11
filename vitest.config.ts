import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts']
  },
  resolve: { alias: { '@': resolve(rootDirectory, './src') } }
});
