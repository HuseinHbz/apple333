import { describe, expect, it } from 'vitest';

import {
  EXPECTED_INVENTORY_TEST_DATABASE,
  EXPECTED_INVENTORY_TEST_PORT,
  EXPECTED_INVENTORY_TEST_USER,
  validateInventoryTestEnvironment,
} from '../../scripts/verify-inventory-test-environment.mjs';
import {
  INVENTORY_BENCHMARK_API_BASE_URL,
  INVENTORY_BENCHMARK_SCALES,
  parseInventoryBenchmarkArguments,
  validateInventoryBenchmarkEnvironment,
} from '../../scripts/benchmark-inventory.mjs';

const testDatabaseUrl = 'postgresql://apple333_inventory_test:local-test-password@127.0.0.1:55433/apple333_inventory_test?schema=public';

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    APPLE333_INVENTORY_TEST_DB: '1',
    INVENTORY_TEST_DATABASE_URL: testDatabaseUrl,
  };
}

describe('Phase 06 isolated inventory environment guards', () => {
  it('accepts only the dedicated loopback inventory database without connecting', () => {
    expect(validateInventoryTestEnvironment(validEnvironment())).toEqual({ ok: true, errors: [] });
  });

  it('fails closed for a non-test runtime, opt-in, host, port, role, or database', () => {
    const result = validateInventoryTestEnvironment({
      ...validEnvironment(),
      NODE_ENV: 'production',
      APPLE333_INVENTORY_TEST_DB: 'true',
      INVENTORY_TEST_DATABASE_URL: 'postgresql://other:password@localhost:5432/other?schema=private',
    });
    expect(result.errors).toEqual(expect.arrayContaining([
      'NODE_ENV must be exactly "test".',
      'APPLE333_INVENTORY_TEST_DB must be exactly "1".',
      `INVENTORY_TEST_DATABASE_URL must use the ${EXPECTED_INVENTORY_TEST_USER} role.`,
      'INVENTORY_TEST_DATABASE_URL host must be exactly 127.0.0.1.',
      `INVENTORY_TEST_DATABASE_URL must use dedicated port ${EXPECTED_INVENTORY_TEST_PORT}.`,
      `INVENTORY_TEST_DATABASE_URL must target /${EXPECTED_INVENTORY_TEST_DATABASE}.`,
      'INVENTORY_TEST_DATABASE_URL must contain exactly one schema=public parameter.',
    ]));
  });

  it('permits only the 10k and 100k benchmark scales', () => {
    expect(INVENTORY_BENCHMARK_SCALES).toEqual([10_000, 100_000]);
    expect(parseInventoryBenchmarkArguments(['--execute', '--scale', '10000'])).toEqual({ help: false, scale: 10_000 });
    expect(() => parseInventoryBenchmarkArguments(['--execute', '--scale', '50000'])).toThrow('--scale must be exactly 10000 or 100000.');
  });

  it('requires explicit safe benchmark opt-in, run identity, local API, and matching ambient database', () => {
    const result = validateInventoryBenchmarkEnvironment({
      ...validEnvironment(),
      DATABASE_URL: testDatabaseUrl,
      INVENTORY_BENCHMARK_ALLOW_SEED: '1',
      INVENTORY_BENCHMARK_RUN_ID: 'phase06-benchmark-01',
      INVENTORY_BENCHMARK_API_BASE_URL,
    });
    expect(result).toEqual({ ok: true, errors: [] });

    const unsafe = validateInventoryBenchmarkEnvironment({
      ...validEnvironment(),
      DATABASE_URL: 'postgresql://production:secret@127.0.0.1:5432/production?schema=public',
      INVENTORY_BENCHMARK_ALLOW_SEED: '0',
      INVENTORY_BENCHMARK_RUN_ID: 'bad',
      INVENTORY_BENCHMARK_API_BASE_URL: 'http://localhost:3000',
    });
    expect(unsafe.errors).toEqual(expect.arrayContaining([
      'INVENTORY_BENCHMARK_ALLOW_SEED must be exactly "1".',
      'INVENTORY_BENCHMARK_RUN_ID must be 8-40 lowercase letters, digits, or hyphens.',
      'DATABASE_URL must be unset or exactly match INVENTORY_TEST_DATABASE_URL.',
      `INVENTORY_BENCHMARK_API_BASE_URL must be exactly "${INVENTORY_BENCHMARK_API_BASE_URL}".`,
    ]));
  });
});
