import { describe, expect, it } from 'vitest';

import {
  summarizeExplain,
  validateStorefrontSearchEvaluationEnvironment,
} from '../../scripts/evaluate-storefront-search.mjs';

const safeEnvironment = {
  NODE_ENV: 'test',
  APPLE333_PIM_TEST_DB: '1',
  PIM_TEST_DATABASE_URL: 'postgresql://apple333_pim_test:test-only@127.0.0.1:55432/apple333_pim_test?schema=public',
  DATABASE_URL: 'postgresql://apple333_pim_test:test-only@127.0.0.1:55432/apple333_pim_test?schema=public',
  STOREFRONT_SEARCH_EVALUATION_ALLOW_READ: '1',
};

describe('storefront search evaluator', () => {
  it('allows only the existing guarded isolated PIM target', () => {
    expect(validateStorefrontSearchEvaluationEnvironment(safeEnvironment)).toEqual(expect.objectContaining({
      ok: true,
      errors: [],
      term: 'iphone',
    }));
  });

  it('rejects a missing explicit read-only opt-in', () => {
    expect(validateStorefrontSearchEvaluationEnvironment({
      ...safeEnvironment,
      STOREFRONT_SEARCH_EVALUATION_ALLOW_READ: undefined,
    })).toEqual(expect.objectContaining({
      ok: false,
      errors: expect.arrayContaining(['STOREFRONT_SEARCH_EVALUATION_ALLOW_READ must be exactly "1".']),
    }));
  });

  it('summarizes safe EXPLAIN evidence without retaining raw plans', () => {
    expect(summarizeExplain([{
      'QUERY PLAN': [{
        'Planning Time': 0.25,
        'Execution Time': 12.5,
        Plan: {
          'Node Type': 'Index Scan',
          'Index Name': 'CatalogProduct_slug_key',
        },
      }],
    }])).toEqual({
      planningMs: 0.25,
      executionMs: 12.5,
      rootNode: 'Index Scan',
      indexes: ['CatalogProduct_slug_key'],
    });
  });
});
