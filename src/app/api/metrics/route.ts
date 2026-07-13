import { collectMetrics, metricsContentType } from '@/server/monitoring/metrics';
import { readiness } from '@/server/services/readiness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Prometheus only reaches this route over the private Docker network. The
 * canonical Compose stack must opt in with METRICS_ENABLED=true. Keeping it
 * disabled by default prevents accidental exposure from a direct Next/PM2 run.
 */
export async function GET(): Promise<Response> {
  if (process.env.METRICS_ENABLED !== 'true') {
    return new Response(null, {
      status: 404,
      headers: { 'cache-control': 'no-store' }
    });
  }

  await readiness();

  return new Response(await collectMetrics(), {
    headers: {
      'cache-control': 'no-store',
      'content-type': metricsContentType()
    }
  });
}
