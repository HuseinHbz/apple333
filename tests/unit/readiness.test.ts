import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkRedisHealth: vi.fn(),
  queryRaw: vi.fn(),
  readServerEnv: vi.fn(),
  recordReadiness: vi.fn()
}));

vi.mock('@/config/env', () => ({ readServerEnv: mocks.readServerEnv }));
vi.mock('@/server/cache/redis', () => ({ checkRedisHealth: mocks.checkRedisHealth }));
vi.mock('@/server/db/prisma', () => ({ prisma: { $queryRaw: mocks.queryRaw } }));
vi.mock('@/server/monitoring/metrics', () => ({ recordReadiness: mocks.recordReadiness }));

import { readiness } from '@/server/services/readiness';

describe('readiness service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readServerEnv.mockReturnValue({});
    mocks.queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mocks.checkRedisHealth.mockResolvedValue({ status: 'ok', latencyMs: 4.2 });
  });

  it('reports ready only after database and Redis checks pass', async () => {
    await expect(readiness()).resolves.toEqual({
      ready: true,
      checks: { configuration: 'ok', database: 'ok', redis: 'ok' }
    });
    expect(mocks.recordReadiness).toHaveBeenCalledWith(expect.objectContaining({ ready: true }), expect.any(Number));
  });

  it('rejects traffic when Redis is unavailable', async () => {
    mocks.checkRedisHealth.mockResolvedValue({ status: 'unavailable', latencyMs: 1500 });

    await expect(readiness()).resolves.toEqual({
      ready: false,
      checks: { configuration: 'ok', database: 'ok', redis: 'unavailable' }
    });
  });

  it('fails closed when required server configuration is invalid', async () => {
    mocks.readServerEnv.mockImplementation(() => {
      throw new Error('invalid configuration');
    });

    await expect(readiness()).resolves.toEqual({
      ready: false,
      checks: { configuration: 'unavailable', database: 'unavailable', redis: 'unavailable' }
    });
    expect(mocks.queryRaw).not.toHaveBeenCalled();
    expect(mocks.checkRedisHealth).not.toHaveBeenCalled();
  });
});
