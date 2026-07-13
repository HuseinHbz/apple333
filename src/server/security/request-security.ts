import { AuthorizationError, RateLimitError } from '@/server/errors/app-error';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, RateLimitEntry>();
const MAX_RATE_LIMIT_KEYS = 10_000;
const RATE_LIMIT_SWEEP_INTERVAL_MS = 1_000;
let nextRateLimitSweepAt = 0;

function pruneRateLimitEntries(now: number): void {
  if (now >= nextRateLimitSweepAt) {
    for (const [key, entry] of attempts) {
      if (entry.resetAt <= now) {
        attempts.delete(key);
      }
    }
    nextRateLimitSweepAt = now + RATE_LIMIT_SWEEP_INTERVAL_MS;
  }

  // This limiter is intentionally only a local defence-in-depth control. A
  // bounded map prevents an untrusted key flood from consuming a worker's
  // memory; the edge proxy remains the authoritative distributed limiter.
  while (attempts.size >= MAX_RATE_LIMIT_KEYS) {
    const oldestKey = attempts.keys().next().value;
    if (!oldestKey) {
      return;
    }
    attempts.delete(oldestKey);
  }
}

export function requestIp(request: Request): string | undefined {
  if (process.env.APPLE333_TRUST_PROXY_HEADERS !== 'true') {
    return undefined;
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  return realIp && realIp.length <= 64 ? realIp : undefined;
}

export function requestUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent')?.slice(0, 512) || undefined;
}

export function assertSameOriginForMutation(request: Request): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return;
  }

  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) {
    throw new AuthorizationError();
  }
}

export function assertRateLimit(key: string, limit = 30, windowMs = 60_000): void {
  const now = Date.now();
  pruneRateLimitEntries(now);
  const previous = attempts.get(key);
  const entry = !previous || previous.resetAt <= now
    ? { count: 1, resetAt: now + windowMs }
    : { count: previous.count + 1, resetAt: previous.resetAt };

  attempts.set(key, entry);
  if (entry.count > limit) {
    throw new RateLimitError();
  }
}

export function noStore(response: Response): Response {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  return response;
}
