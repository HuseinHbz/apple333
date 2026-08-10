import { afterEach, describe, expect, it, vi } from 'vitest';

import { assertRateLimit, assertSameOriginForMutation, requestIp } from '@/server/security/request-security';
import { AuthorizationError, RateLimitError } from '@/server/errors/app-error';

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

  it('accepts a same-origin mutation with Origin or a browser Referer fallback', () => {
    vi.stubEnv('APP_URL', 'https://apple333.test');

    expect(() => assertSameOriginForMutation(new Request('https://apple333.test/api/inventory', {
      method: 'POST',
      headers: { origin: 'https://apple333.test' },
    }))).not.toThrow();
    expect(() => assertSameOriginForMutation(new Request('https://apple333.test/api/inventory', {
      method: 'POST',
      headers: { referer: 'https://apple333.test/admin/inventory' },
    }))).not.toThrow();
  });

  it('uses the trusted public APP_URL when a reverse proxy changes the internal request URL', () => {
    vi.stubEnv('APP_URL', 'https://apple333.test');
    expect(() => assertSameOriginForMutation(new Request('http://next-internal:3000/api/inventory', {
      method: 'POST',
      headers: { origin: 'https://apple333.test' },
    }))).not.toThrow();
  });

  it('rejects mutations without trustworthy same-origin evidence', () => {
    expect(() => assertSameOriginForMutation(new Request('https://apple333.test/api/inventory', {
      method: 'POST',
      headers: { referer: 'https://attacker.example/form' },
    }))).toThrow(AuthorizationError);
    expect(() => assertSameOriginForMutation(new Request('https://apple333.test/api/inventory', {
      method: 'POST',
    }))).toThrow(AuthorizationError);
  });
});
