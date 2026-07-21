import { describe, expect, it } from 'vitest';

import { validateE2eStorefrontSeedEnvironment } from '../../scripts/seed-e2e-storefront.mjs';

const safeEnvironment = {
  NODE_ENV: 'test',
  APPLE333_E2E_TEST_DB: '1',
  DATABASE_URL: 'postgresql://apple:test-only@127.0.0.1:5432/apple333_test?schema=public',
};

describe('E2E storefront fixture environment guard', () => {
  it('accepts only an explicitly opted-in loopback test database', () => {
    expect(validateE2eStorefrontSeedEnvironment(safeEnvironment)).toEqual({ ok: true, errors: [] });
  });

  it('rejects a target without the explicit test opt-in', () => {
    expect(validateE2eStorefrontSeedEnvironment({
      ...safeEnvironment,
      APPLE333_E2E_TEST_DB: undefined,
    })).toEqual(expect.objectContaining({
      ok: false,
      errors: expect.arrayContaining(['APPLE333_E2E_TEST_DB must be exactly "1".']),
    }));
  });

  it('rejects remote and non-test database targets before a client can connect', () => {
    expect(validateE2eStorefrontSeedEnvironment({
      ...safeEnvironment,
      DATABASE_URL: 'postgresql://apple:test-only@postgres.example.test:5432/apple333?schema=public',
    })).toEqual(expect.objectContaining({
      ok: false,
      errors: expect.arrayContaining([
        'DATABASE_URL must use a loopback database host.',
        'DATABASE_URL must target the dedicated apple333 test database.',
      ]),
    }));
  });
});
