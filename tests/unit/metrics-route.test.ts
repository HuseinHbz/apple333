import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  collectMetrics: vi.fn(),
  metricsContentType: vi.fn(),
  readiness: vi.fn()
}));

vi.mock('@/server/monitoring/metrics', () => ({
  collectMetrics: mocks.collectMetrics,
  metricsContentType: mocks.metricsContentType
}));
vi.mock('@/server/services/readiness', () => ({ readiness: mocks.readiness }));

import { GET } from '@/app/api/metrics/route';

describe('Prometheus metrics route', () => {
  beforeEach(() => {
    vi.stubEnv('METRICS_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns 404 unless the private metrics integration is explicitly enabled', async () => {
    vi.stubEnv('METRICS_ENABLED', 'false');

    const response = await GET();

    expect(response.status).toBe(404);
    expect(mocks.readiness).not.toHaveBeenCalled();
  });

  it('refreshes dependency gauges and prevents intermediary caching', async () => {
    mocks.readiness.mockResolvedValue({ ready: true });
    mocks.collectMetrics.mockResolvedValue('apple333_readiness_up 1\n');
    mocks.metricsContentType.mockReturnValue('text/plain; version=0.0.4; charset=utf-8');

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toContain('text/plain');
    await expect(response.text()).resolves.toContain('apple333_readiness_up 1');
    expect(mocks.readiness).toHaveBeenCalledOnce();
  });
});
