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

function trustedApplicationOrigin(request: Request): string {
  // APP_URL is validated by the server environment and represents the public
  // origin. Prefer it over a framework-internal request URL, which can differ
  // when Next.js runs behind a reverse proxy or standalone runtime.
  if (process.env.APP_URL) {
    return new URL(process.env.APP_URL).origin;
  }
  return new URL(request.url).origin;
}

export function assertSameOriginForMutation(request: Request): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return;
  }

  const requestOrigin = trustedApplicationOrigin(request);
  const origin = request.headers.get('origin');
  if (origin) {
    if (origin !== requestOrigin) {
      throw new AuthorizationError();
    }
    return;
  }

  // Same-origin browser mutations do not consistently send Origin. A Referer
  // fallback preserves CSRF protection without rejecting legitimate browser
  // fetches; missing, malformed, or cross-origin values still fail closed.
  const referer = request.headers.get('referer');
  try {
    if (!referer || new URL(referer).origin !== requestOrigin) {
      throw new AuthorizationError();
    }
  } catch {
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
