import { AuthorizationError, RateLimitError } from '@/server/errors/app-error';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, RateLimitEntry>();

export function requestIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined;
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
