import { afterEach, describe, expect, it } from 'vitest';

import { checkRedisHealth } from '@/server/cache/redis';

const originalRedisUrl = process.env.REDIS_URL;

afterEach(() => {
  if (originalRedisUrl === undefined) {
    delete process.env.REDIS_URL;
  } else {
    process.env.REDIS_URL = originalRedisUrl;
  }
});

describe('Redis health adapter', () => {
  it('reports disabled rather than attempting a network connection without REDIS_URL', async () => {
    delete process.env.REDIS_URL;

    await expect(checkRedisHealth()).resolves.toEqual({ status: 'disabled', latencyMs: null });
  });
});
