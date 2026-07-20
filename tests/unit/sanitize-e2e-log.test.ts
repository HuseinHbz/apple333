import { describe, expect, it } from 'vitest';

import { sanitizeE2eLog } from '../../scripts/sanitize-e2e-log.mjs';

describe('E2E diagnostic log sanitizer', () => {
  it('redacts credentials, bearer tokens, cookies, and sensitive environment values', () => {
    const sanitized = sanitizeE2eLog([
      'DATABASE_URL=postgresql://apple333:test-only@127.0.0.1:5432/apple333_test',
      'REDIS_URL=redis://:redis-secret@127.0.0.1:6379',
      'Authorization: Bearer example-access-token',
      'Set-Cookie: session=example-cookie; HttpOnly',
      '{"AUTH_SECRET":"example-auth-secret"}',
      'NEXTAUTH_SECRET: example-nextauth-secret',
      'https://staging.example.test/callback?token=example-query-token',
    ].join('\n'));

    expect(sanitized).toContain('DATABASE_URL=[REDACTED]');
    expect(sanitized).toContain('REDIS_URL=[REDACTED]');
    expect(sanitized).toContain('Authorization: Bearer [REDACTED]');
    expect(sanitized).toContain('Set-Cookie: [REDACTED]');
    expect(sanitized).toContain('"AUTH_SECRET":"[REDACTED]"');
    expect(sanitized).toContain('NEXTAUTH_SECRET: [REDACTED]');
    expect(sanitized).toContain('token=[REDACTED]');
    expect(sanitized).not.toContain('test-only');
    expect(sanitized).not.toContain('redis-secret');
    expect(sanitized).not.toContain('example-auth-secret');
    expect(sanitized).not.toContain('example-nextauth-secret');
    expect(sanitized).not.toContain('example-query-token');
  });

  it('leaves non-sensitive diagnostics readable', () => {
    expect(sanitizeE2eLog('Apple333 storefront started on http://127.0.0.1:3000')).toBe(
      'Apple333 storefront started on http://127.0.0.1:3000',
    );
  });
});
