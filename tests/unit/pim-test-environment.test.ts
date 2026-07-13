import { describe, expect, it } from 'vitest';

import {
  EXPECTED_PIM_TEST_DATABASE,
  EXPECTED_PIM_TEST_PORT,
  EXPECTED_PIM_TEST_USER,
  validatePimTestEnvironment
} from '../../scripts/verify-pim-test-environment.mjs';

const validEnvironment = {
  NODE_ENV: 'test',
  APPLE333_PIM_TEST_DB: '1',
  PIM_TEST_DATABASE_URL:
    'postgresql://apple333_pim_test:local-test-password@127.0.0.1:55432/apple333_pim_test?schema=public'
};

describe('PIM test database environment preflight', () => {
  it('accepts only the dedicated local test target without connecting', () => {
    expect(validatePimTestEnvironment(validEnvironment)).toEqual({ ok: true, errors: [] });
  });

  it('requires an explicit test opt-in', () => {
    const result = validatePimTestEnvironment({ ...validEnvironment, APPLE333_PIM_TEST_DB: 'true' });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('APPLE333_PIM_TEST_DB must be exactly "1".');
  });

  it('requires the test runtime mode as well as the explicit database opt-in', () => {
    const result = validatePimTestEnvironment({ ...validEnvironment, NODE_ENV: 'development' });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('NODE_ENV must be exactly "test".');
  });

  it('rejects any non-loopback target and the default PostgreSQL port', () => {
    const result = validatePimTestEnvironment({
      ...validEnvironment,
      PIM_TEST_DATABASE_URL:
        'postgresql://apple333_pim_test:local-test-password@database.example:5432/apple333_pim_test?schema=public'
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('PIM_TEST_DATABASE_URL host must be a loopback address.');
    expect(result.errors).toContain(`PIM_TEST_DATABASE_URL must use dedicated port ${EXPECTED_PIM_TEST_PORT}.`);
  });

  it('rejects DNS hostnames, including localhost, to avoid name-resolution bypasses', () => {
    const result = validatePimTestEnvironment({
      ...validEnvironment,
      PIM_TEST_DATABASE_URL:
        'postgresql://apple333_pim_test:local-test-password@localhost:55432/apple333_pim_test?schema=public'
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('PIM_TEST_DATABASE_URL host must be a loopback address.');
  });

  it('rejects a different database role or database name', () => {
    const result = validatePimTestEnvironment({
      ...validEnvironment,
      PIM_TEST_DATABASE_URL: 'postgresql://other:password@localhost:55432/other?schema=public'
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(`PIM_TEST_DATABASE_URL must use the ${EXPECTED_PIM_TEST_USER} role.`);
    expect(result.errors).toContain(`PIM_TEST_DATABASE_URL must target /${EXPECTED_PIM_TEST_DATABASE}.`);
  });

  it('fails closed for a missing URL or a non-public schema', () => {
    expect(validatePimTestEnvironment({ NODE_ENV: 'test', APPLE333_PIM_TEST_DB: '1' })).toEqual({
      ok: false,
      errors: ['PIM_TEST_DATABASE_URL is required.']
    });

    const schemaResult = validatePimTestEnvironment({
      ...validEnvironment,
      PIM_TEST_DATABASE_URL:
        'postgresql://apple333_pim_test:password@localhost:55432/apple333_pim_test?schema=private'
    });

    expect(schemaResult.ok).toBe(false);
    expect(schemaResult.errors).toContain('PIM_TEST_DATABASE_URL must contain exactly one schema=public parameter.');
  });
});
