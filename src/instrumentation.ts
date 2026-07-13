import * as Sentry from '@sentry/nextjs';

function sampleRate(value: string | undefined): number {
  const parsed = Number(value ?? 0.1);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0.1;
}

function serverSentryOptions() {
  const dsn = process.env.SENTRY_DSN;

  return {
    ...(dsn ? { dsn } : {}),
    enabled: process.env.NODE_ENV === 'production' && Boolean(dsn),
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: sampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
    sendDefaultPii: false
  };
}

function removeSensitiveRequestData(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (!event.request) {
    return event;
  }

  const {
    cookies: _cookies,
    data: _data,
    env: _env,
    headers: requestHeaders,
    query_string: _queryString,
    ...request
  } = event.request;
  const sensitiveHeaders = new Set([
    'authorization',
    'cookie',
    'proxy-authorization',
    'x-api-key',
    'x-client-ip',
    'x-forwarded-for',
    'x-real-ip'
  ]);
  const headers = Object.fromEntries(
    Object.entries(requestHeaders ?? {}).filter(
      ([headerName]) => !sensitiveHeaders.has(headerName.toLowerCase())
    )
  );

  return { ...event, request: { ...request, headers } };
}

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      ...serverSentryOptions(),
      beforeSend: removeSensitiveRequestData
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({ ...serverSentryOptions(), beforeSend: removeSensitiveRequestData });
  }
}

// Next.js calls this hook for instrumentation-level request errors. Sentry
// performs its own privacy filtering before a configured DSN receives events.
export const onRequestError = Sentry.captureRequestError;
