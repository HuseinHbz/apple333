import type { z } from 'zod';

import { failure, requestId, success } from '@/server/api/response';
import { log } from '@/server/logging/logger';
import { assertRateLimit, assertSameOriginForMutation, requestIp } from '@/server/security/request-security';

export function publicStoreResponse<T>(request: Request, data: T, status = 200): Response {
  const response = success(data, { requestId: requestId(request) }, status);
  response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  return response;
}

export function privateStoreResponse<T>(request: Request, data: T, status = 200): Response {
  const response = success(data, { requestId: requestId(request) }, status);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

type ParsedStoreRouteOptions<T> = Readonly<{
  rateLimitKey: string;
  mutation?: boolean;
  parse: (request: Request) => Promise<T>;
  handler: (input: T) => Promise<Response>;
}>;

type UnparsedStoreRouteOptions = Readonly<{
  rateLimitKey: string;
  mutation?: boolean;
  parse?: never;
  handler: () => Promise<Response>;
}>;

export function runStoreRoute<T>(request: Request, options: ParsedStoreRouteOptions<T>): Promise<Response>;
export function runStoreRoute(request: Request, options: UnparsedStoreRouteOptions): Promise<Response>;
export async function runStoreRoute<T>(
  request: Request,
  options: ParsedStoreRouteOptions<T> | UnparsedStoreRouteOptions,
): Promise<Response> {
  const meta = { requestId: requestId(request) };
  const startedAt = Date.now();
  try {
    if (options.mutation) assertSameOriginForMutation(request);
    assertRateLimit(`${requestIp(request) ?? 'anonymous'}:${options.rateLimitKey}`, options.mutation ? 20 : 90);
    const response = 'parse' in options
      ? await (options as ParsedStoreRouteOptions<T>).handler(await (options as ParsedStoreRouteOptions<T>).parse(request))
      : await (options as UnparsedStoreRouteOptions).handler();
    response.headers.set('x-request-id', meta.requestId);
    log('info', 'storefront_request_completed', { requestId: meta.requestId, route: new URL(request.url).pathname, method: request.method, durationMs: Date.now() - startedAt });
    return response;
  } catch (error) {
    log('warn', 'storefront_request_rejected', { requestId: meta.requestId, route: new URL(request.url).pathname, method: request.method, durationMs: Date.now() - startedAt, errorCode: error instanceof Error ? error.name : 'UNKNOWN' });
    const response = failure(error, meta);
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return response;
  }
}

export function queryInput<TSchema extends z.ZodType>(schema: TSchema): (request: Request) => Promise<z.output<TSchema>> {
  return async (request) => schema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
}

export function jsonInput<TSchema extends z.ZodType>(schema: TSchema): (request: Request) => Promise<z.output<TSchema>> {
  return async (request) => schema.parse(await request.json());
}
