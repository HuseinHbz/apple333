import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const parsedSampleRate = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1);

Sentry.init({
  ...(dsn ? { dsn } : {}),
  enabled: process.env.NODE_ENV === 'production' && Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: Number.isFinite(parsedSampleRate)
    ? Math.min(Math.max(parsedSampleRate, 0), 1)
    : 0.1,
  sendDefaultPii: false,
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
