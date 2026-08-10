import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  EXPECTED_INVENTORY_TEST_DATABASE,
  EXPECTED_INVENTORY_TEST_PORT,
  EXPECTED_INVENTORY_TEST_USER,
  validateInventoryTestEnvironment,
} from '../../scripts/verify-inventory-test-environment.mjs';
import {
  INVENTORY_BENCHMARK_API_BASE_URL,
  INVENTORY_BENCHMARK_SCALES,
  buildInventoryBenchmarkBatch,
  parseInventoryBenchmarkArguments,
  validateInventoryBenchmarkEnvironment,
} from '../../scripts/benchmark-inventory.mjs';
import {
  INVENTORY_TEST_REDIS_URL,
  validateInventoryE2eEnvironment,
} from '../../scripts/run-inventory-e2e-tests.mjs';

const testDatabaseUrl = 'postgresql://apple333_phase06_test:local-test-password@127.0.0.1:55433/apple333_phase06_test?schema=public';

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    APPLE333_TEST_DB: '1',
    INVENTORY_TEST_DATABASE_URL: testDatabaseUrl,
  };
}

describe('Phase 06 isolated inventory environment guards', () => {
  it('accepts only the dedicated loopback inventory database without connecting', () => {
    expect(validateInventoryTestEnvironment(validEnvironment())).toEqual({ ok: true, errors: [] });
  });

  it('requires the Phase 06.1 acknowledgement and fails closed for an unsafe runtime or identity', () => {
    const result = validateInventoryTestEnvironment({
      ...validEnvironment(),
      NODE_ENV: 'production',
      APPLE333_TEST_DB: 'true',
      APPLE333_INVENTORY_TEST_DB: 'true',
      INVENTORY_TEST_DATABASE_URL: 'postgresql://other:password@localhost:5432/other?schema=private',
    });
    expect(result.errors).toEqual(expect.arrayContaining([
      'NODE_ENV must be exactly "test".',
      'APPLE333_TEST_DB must be exactly "1".',
      'APPLE333_INVENTORY_TEST_DB, when set for compatibility, must be exactly "1".',
      `INVENTORY_TEST_DATABASE_URL must use the ${EXPECTED_INVENTORY_TEST_USER} role.`,
      'INVENTORY_TEST_DATABASE_URL host must be exactly 127.0.0.1.',
      `INVENTORY_TEST_DATABASE_URL must use dedicated port ${EXPECTED_INVENTORY_TEST_PORT}.`,
      `INVENTORY_TEST_DATABASE_URL must target /${EXPECTED_INVENTORY_TEST_DATABASE}.`,
      'INVENTORY_TEST_DATABASE_URL must contain exactly one schema=public parameter.',
    ]));
  });

  it('allows the legacy acknowledgement only as an additional valid assertion', () => {
    expect(validateInventoryTestEnvironment({
      ...validEnvironment(),
      APPLE333_INVENTORY_TEST_DB: '1',
      INVENTORY_TEST_POSTGRES_DB: EXPECTED_INVENTORY_TEST_DATABASE,
      INVENTORY_TEST_POSTGRES_USER: EXPECTED_INVENTORY_TEST_USER,
      INVENTORY_TEST_POSTGRES_BIND: '127.0.0.1',
      INVENTORY_TEST_POSTGRES_PORT: EXPECTED_INVENTORY_TEST_PORT,
      DATABASE_URL: testDatabaseUrl,
    })).toEqual({ ok: true, errors: [] });

    expect(validateInventoryTestEnvironment({
      ...validEnvironment(),
      APPLE333_INVENTORY_TEST_DB: '1',
      INVENTORY_TEST_POSTGRES_DB: 'apple333_inventory_test',
      DATABASE_URL: 'postgresql://other:password@127.0.0.1:55433/other?schema=public',
    }).errors).toEqual(expect.arrayContaining([
      `INVENTORY_TEST_POSTGRES_DB, when set, must be exactly "${EXPECTED_INVENTORY_TEST_DATABASE}".`,
      'DATABASE_URL must be unset or exactly match INVENTORY_TEST_DATABASE_URL.',
    ]));
  });

  it('declares an owned, loopback-only disposable PostgreSQL service', () => {
    const environmentTemplate = readFileSync(resolve('.env.inventory-test.example'), 'utf8');
    const compose = readFileSync(resolve('docker-compose.inventory-test.yml'), 'utf8');

    expect(environmentTemplate).toContain('APPLE333_TEST_DB=1');
    expect(environmentTemplate).toContain(`INVENTORY_TEST_DATABASE_URL=${testDatabaseUrl.replace('local-test-password', 'local-test-only-change-me')}`);
    expect(environmentTemplate).toContain(`INVENTORY_TEST_REDIS_URL=${INVENTORY_TEST_REDIS_URL}`);
    expect(compose).toContain('apple333-phase06-redis:');
    expect(compose).toContain('container_name: apple333-phase06-redis');
    expect(compose).toContain('127.0.0.1:56379:6379');
    expect(compose).toContain('apple333-phase06-postgres:');
    expect(compose).toContain('container_name: apple333-phase06-postgres');
    expect(compose).toContain(`POSTGRES_DB: ${EXPECTED_INVENTORY_TEST_DATABASE}`);
    expect(compose).toContain(`POSTGRES_USER: ${EXPECTED_INVENTORY_TEST_USER}`);
    expect(compose).toContain('127.0.0.1:');
    expect(compose).not.toContain(':5432:5432');
    expect(compose).toContain('driver: bridge');
    expect(compose).not.toContain('internal: true');
    expect(compose).toContain('com.apple333.owner: phase-06.1');
    expect(compose).toContain('com.apple333.disposable: "true"');
    expect(compose).toContain('healthcheck:');
  });

  it('fails closed when E2E runtime evidence would inherit a non-isolated Redis target', () => {
    expect(validateInventoryE2eEnvironment({
      ...validEnvironment(),
      APPLE333_E2E_TEST_DB: '1',
      INVENTORY_TEST_REDIS_URL,
    })).toEqual({ ok: true, errors: [] });
    expect(validateInventoryE2eEnvironment({
      ...validEnvironment(),
      APPLE333_E2E_TEST_DB: '1',
      INVENTORY_TEST_REDIS_URL,
      REDIS_URL: 'redis://production.example:6379',
    }).errors).toContain('REDIS_URL must be unset or exactly match INVENTORY_TEST_REDIS_URL.');
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

  it('creates one sellable BranchInventory projection for every benchmark physical balance', () => {
    const context = {
      prefix: 'inventory-benchmark-unit-test',
      productId: 'benchmark-product',
      branchId: (index: number) => `branch-${index}`,
      warehouseId: (index: number) => `warehouse-${index}`,
      locationId: (index: number) => `location-${index}`,
      variantId: (ordinal: number) => `variant-${ordinal}`,
      skuId: (ordinal: number) => `sku-${ordinal}`,
      skuCode: (ordinal: number) => `SKU-${ordinal}`,
    };

    const batch = buildInventoryBenchmarkBatch(context, 7, 2);

    expect(batch.balances).toHaveLength(8);
    expect(batch.projections).toHaveLength(8);
    expect(batch.projections).toEqual(expect.arrayContaining([
      { branchId: 'branch-1', variantId: 'variant-7', onHand: 2, reserved: 0 },
      { branchId: 'branch-4', variantId: 'variant-8', onHand: 6, reserved: 0 },
    ]));
    expect(batch.projections.map((projection) => ({
      branchId: projection.branchId,
      variantId: projection.variantId,
      onHand: projection.onHand,
      reserved: projection.reserved,
    }))).toEqual(batch.balances.map((balance) => ({
      branchId: balance.warehouseId.replace('warehouse-', 'branch-'),
      variantId: balance.skuId.replace('sku-', 'variant-'),
      onHand: balance.quantity,
      reserved: balance.reservedQuantity,
    })));
  });
});
