import { describe, expect, it, vi } from 'vitest';

const readiness = vi.hoisted(() => vi.fn());
vi.mock('@/server/services/readiness', () => ({ readiness }));

import { GET } from '@/app/api/ready/route';

describe('readiness route', () => {
  it('returns 200 only when all dependency checks are ready', async () => {
    readiness.mockResolvedValue({
      ready: true,
      checks: { configuration: 'ok', database: 'ok', redis: 'ok' }
    });

    const response = await GET(new Request('http://localhost/api/ready'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, data: { ready: true } });
  });

  it('returns 503 and a sanitized dependency state when traffic is unsafe', async () => {
    readiness.mockResolvedValue({
      ready: false,
      checks: { configuration: 'ok', database: 'ok', redis: 'unavailable' }
    });

    const response = await GET(new Request('http://localhost/api/ready'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { ready: false, checks: { redis: 'unavailable' } }
    });
  });
});
