import { describe,expect,it } from 'vitest';
import { vi } from 'vitest';

const readiness = vi.hoisted(() => vi.fn());
vi.mock('@/server/services/readiness', () => ({ readiness }));

import { GET } from '@/app/api/health/route';

describe('health route', () => {
  it('returns non-secret production and database status in the standard envelope', async () => {
    readiness.mockResolvedValue({
      ready: true,
      checks: { configuration: 'ok', database: 'ok', redis: 'ok' }
    });

    const response = await GET(new Request('http://localhost/api/health'));
    const body = await response.json() as {
      success: boolean;
      data: { status: string; database: string; checks: { database: string } };
    };

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ status: 'ok', database: 'connected' })
    }));
  });

  it('returns 503 when a dependency is unavailable', async () => {
    readiness.mockResolvedValue({
      ready: false,
      checks: { configuration: 'ok', database: 'unavailable', redis: 'ok' }
    });

    const response = await GET(new Request('http://localhost/api/health'));
    await expect(response.json()).resolves.toMatchObject({
      data: { status: 'degraded', database: 'unavailable' }
    });
    expect(response.status).toBe(503);
  });
});
