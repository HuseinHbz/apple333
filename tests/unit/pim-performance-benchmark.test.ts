import { describe, expect, it } from 'vitest';

import {
  PIM_BENCHMARK_API_BASE_URL,
  PIM_BENCHMARK_HTTP_SAMPLE_COUNT,
  PIM_BENCHMARK_SCALES,
  parseBenchmarkArguments,
  parseBoundedInteger,
  publicApiBenchmarkPaths,
  resolvePimBenchmarkApiOptions,
  summarizePublicApiBody,
  summarizeExplainRows,
  validatePimBenchmarkApiBaseUrl,
  validatePimBenchmarkEnvironment,
} from '../../scripts/benchmark-pim-catalog.mjs';

const testDatabaseUrl = 'postgresql://apple333_pim_test:local-test-password@127.0.0.1:55432/apple333_pim_test?schema=public';

function validEnvironment() {
  return {
    NODE_ENV: 'test',
    APPLE333_PIM_TEST_DB: '1',
    PIM_TEST_DATABASE_URL: testDatabaseUrl,
    DATABASE_URL: testDatabaseUrl,
    PIM_BENCHMARK_ALLOW_SEED: '1',
    PIM_BENCHMARK_RUN_ID: 'phase041-benchmark-01',
    PIM_BENCHMARK_API_BASE_URL,
  };
}

describe('PIM performance benchmark harness', () => {
  it('uses the required 10k then 100k benchmark scales', () => {
    expect(PIM_BENCHMARK_SCALES).toEqual([10_000, 100_000]);
  });

  it('accepts only the explicit guarded isolated benchmark environment', () => {
    expect(validatePimBenchmarkEnvironment(validEnvironment())).toEqual({ ok: true, errors: [] });
  });

  it('fails closed when the large fixture opt-in, run identifier, or ambient database target is unsafe', () => {
    const noOptIn = validatePimBenchmarkEnvironment({ ...validEnvironment(), PIM_BENCHMARK_ALLOW_SEED: undefined });
    expect(noOptIn.errors).toContain('PIM_BENCHMARK_ALLOW_SEED must be exactly "1".');

    const unsafeRunId = validatePimBenchmarkEnvironment({ ...validEnvironment(), PIM_BENCHMARK_RUN_ID: 'BAD' });
    expect(unsafeRunId.errors).toContain('PIM_BENCHMARK_RUN_ID must be 8-40 lowercase letters, digits, or hyphens and cannot start or end with a hyphen.');

    const unsafeDatabaseUrl = validatePimBenchmarkEnvironment({
      ...validEnvironment(),
      DATABASE_URL: 'postgresql://production:secret@127.0.0.1:5432/production?schema=public',
    });
    expect(unsafeDatabaseUrl.errors).toContain('DATABASE_URL must be unset or exactly match PIM_TEST_DATABASE_URL for this benchmark.');
  });

  it('requires an explicit --execute command and bounds runtime tuning values', () => {
    expect(parseBenchmarkArguments(['--execute'])).toEqual({ help: false, execute: true });
    expect(parseBenchmarkArguments(['--help'])).toEqual({ help: true, execute: false });
    expect(() => parseBenchmarkArguments([])).toThrow('Use exactly --execute');
    expect(parseBoundedInteger(undefined, 500, 100, 1_000, 'batch')).toBe(500);
    expect(() => parseBoundedInteger('1001', 500, 100, 1_000, 'batch')).toThrow('batch must be between 100 and 1000.');
  });

  it('allows only the explicit loopback API target and coherent bounded API thresholds', () => {
    expect(validatePimBenchmarkApiBaseUrl(PIM_BENCHMARK_API_BASE_URL)).toEqual({ ok: true, errors: [] });
    expect(validatePimBenchmarkApiBaseUrl('http://localhost:3000').ok).toBe(false);
    expect(validatePimBenchmarkApiBaseUrl('http://127.0.0.1:3000/').ok).toBe(false);
    const options = resolvePimBenchmarkApiOptions(validEnvironment());
    expect(options.baseUrl.toString()).toBe(`${PIM_BENCHMARK_API_BASE_URL}/`);
    expect(options).toMatchObject({ requestTimeoutMs: 10_000, p95ThresholdMs: 3_000 });
    expect(() => resolvePimBenchmarkApiOptions({
      ...validEnvironment(),
      PIM_BENCHMARK_API_TIMEOUT_MS: '1000',
      PIM_BENCHMARK_API_P95_MS: '1001',
    })).toThrow('PIM_BENCHMARK_API_P95_MS must be less than or equal to PIM_BENCHMARK_API_TIMEOUT_MS.');
  });

  it('uses five fixed, public GET paths and emits body metadata without raw response content', () => {
    expect(PIM_BENCHMARK_HTTP_SAMPLE_COUNT).toBe(5);
    expect(publicApiBenchmarkPaths('benchmark-category', 'benchmark-product')).toEqual([
      { path: 'public-listing', requestPath: '/api/products?page=1&pageSize=24&sort=newest' },
      { path: 'public-category-filtered-listing', requestPath: '/api/products?page=1&pageSize=24&sort=newest&category=benchmark-category' },
      { path: 'public-detail', requestPath: '/api/products/benchmark-product' },
      { path: 'public-category-list', requestPath: '/api/categories' },
    ]);
    expect(summarizePublicApiBody(
      '{"success":true,"data":{"items":[{"name":"not-emitted"}],"total":100000},"meta":{"requestId":"not-emitted"}}',
      111,
      'application/json; charset=utf-8',
    )).toEqual({
      bytes: 111,
      contentType: 'application/json',
      json: {
        valid: true,
        root: 'object',
        success: true,
        data: { type: 'object', itemCount: 1, total: 100_000 },
      },
    });
  });

  it('extracts non-sensitive timing and index evidence from a JSON EXPLAIN result', () => {
    const summary = summarizeExplainRows([{
      'QUERY PLAN': [{
        Plan: {
          'Node Type': 'Limit',
          'Actual Rows': 24,
          'Plan Rows': 24,
          'Shared Hit Blocks': 12,
          'Shared Read Blocks': 0,
          Plans: [{
            'Node Type': 'Index Scan',
            'Relation Name': 'CatalogProduct',
            'Index Name': 'CatalogProduct_status_publishedAt_idx',
          }],
        },
        'Planning Time': 0.25,
        'Execution Time': 1.75,
      }],
    }]);

    expect(summary).toMatchObject({
      planningMs: 0.25,
      executionMs: 1.75,
      rootNode: 'Limit',
      actualRows: 24,
      sharedHitBlocks: 12,
      indexes: ['Index Scan:CatalogProduct:CatalogProduct_status_publishedAt_idx'],
    });
  });
});
