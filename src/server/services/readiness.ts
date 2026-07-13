import { readServerEnv } from '@/config/env';
import { checkRedisHealth } from '@/server/cache/redis';
import { recordReadiness } from '@/server/monitoring/metrics';
import { prisma } from '@/server/db/prisma';

export type ReadinessCheckStatus = 'ok' | 'disabled' | 'unavailable';

export type ReadinessResult = {
  ready: boolean;
  checks: {
    configuration: ReadinessCheckStatus;
    database: ReadinessCheckStatus;
    redis: ReadinessCheckStatus;
  };
};

async function databaseStatus(): Promise<ReadinessCheckStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'ok';
  } catch {
    return 'unavailable';
  }
}

export async function readiness(): Promise<ReadinessResult> {
  const startedAt = performance.now();

  try {
    readServerEnv();
  } catch {
    const result: ReadinessResult = {
      ready: false,
      checks: { configuration: 'unavailable', database: 'unavailable', redis: 'unavailable' }
    };
    recordReadiness(result, performance.now() - startedAt);
    return result;
  }

  const [database, redis] = await Promise.all([
    databaseStatus(),
    checkRedisHealth()
  ]);
  const result: ReadinessResult = {
    ready: database === 'ok' && (redis.status === 'ok' || redis.status === 'disabled'),
    checks: {
      configuration: 'ok',
      database,
      redis: redis.status
    }
  };

  recordReadiness(result, performance.now() - startedAt);
  return result;
}
