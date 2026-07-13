import { afterEach, describe, expect, it, vi } from 'vitest';

import { assertRateLimit, requestIp } from '@/server/security/request-security';
import { RateLimitError } from '@/server/errors/app-error';

describe('request security helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not trust client-supplied forwarding headers by default', () => {
    const request = new Request('https://example.test', {
      headers: {
        'x-forwarded-for': '198.51.100.10',
        'x-real-ip': '198.51.100.10'
      }
    });

    expect(requestIp(request)).toBeUndefined();
  });

  it('uses only the sanitized real-IP header after the managed proxy opts in', () => {
    vi.stubEnv('APPLE333_TRUST_PROXY_HEADERS', 'true');
    const request = new Request('https://example.test', {
      headers: {
        'x-forwarded-for': '198.51.100.10, 192.0.2.1',
        'x-real-ip': '203.0.113.42'
      }
    });

    expect(requestIp(request)).toBe('203.0.113.42');
  });

  it('enforces a bounded request window', () => {
    const key = `unit-rate-limit-${Date.now()}-${Math.random()}`;

    expect(() => assertRateLimit(key, 1, 60_000)).not.toThrow();
    expect(() => assertRateLimit(key, 1, 60_000)).toThrow(RateLimitError);
  });
});
