import { requestId, success } from '@/server/api/response';
import { readiness } from '@/server/services/readiness';

export async function GET(request: Request) {
  const meta = { requestId: requestId(request) };
  const state = await readiness();

  return success(
    {
      status: state.ready ? 'ok' : 'degraded',
      environment: process.env.APPLE333_RUNTIME_ENVIRONMENT ?? process.env.NODE_ENV ?? 'unknown',
      database: state.checks.database === 'ok' ? 'connected' : 'unavailable',
      checks: state.checks
    },
    meta,
    state.ready ? 200 : 503
  );
}
