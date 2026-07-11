import type { z } from 'zod';

import { failure, requestId, success } from '@/server/api/response';
import { log } from '@/server/logging/logger';
import { requireAdminActor } from '@/modules/auth/session';
import type { Permission, SessionActor } from '@/server/security/permissions';
import { requirePermission } from '@/server/security/permissions';
import { assertRateLimit, assertSameOriginForMutation, noStore, requestIp, requestUserAgent } from '@/server/security/request-security';

export type AuditContext = {
  actorId: string;
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
};

export type AdminRouteContext<TInput> = {
  request: Request;
  actor: SessionActor;
  input: TInput;
  audit: AuditContext;
};

type AdminRouteBase<TResult> = {
  permission: Permission;
  mutation?: boolean;
  status?: number;
};

type AdminRouteWithInput<TInput, TResult> = AdminRouteBase<TResult> & {
  parse: (request: Request) => Promise<TInput>;
  handler: (context: AdminRouteContext<TInput>) => Promise<TResult>;
};

type AdminRouteWithoutInput<TResult> = AdminRouteBase<TResult> & {
  parse?: undefined;
  handler: (context: AdminRouteContext<undefined>) => Promise<TResult>;
};

export function jsonBody<TSchema extends z.ZodType>(schema: TSchema): (request: Request) => Promise<z.output<TSchema>> {
  return async (request) => schema.parse(await request.json());
}

export function queryParams<TSchema extends z.ZodType>(schema: TSchema): (request: Request) => Promise<z.output<TSchema>> {
  return async (request) => {
    const values = Object.fromEntries(new URL(request.url).searchParams.entries());
    return schema.parse(values);
  };
}

export function withAdminRoute<TInput, TResult = unknown>(
  options: AdminRouteWithInput<TInput, TResult>
): (request: Request) => Promise<Response>;
export function withAdminRoute<TResult>(
  options: AdminRouteWithoutInput<TResult>
): (request: Request) => Promise<Response>;
export function withAdminRoute<TInput, TResult>(
  options: AdminRouteWithInput<TInput, TResult> | AdminRouteWithoutInput<TResult>
): (request: Request) => Promise<Response> {
  return async (request) => {
    const meta = { requestId: requestId(request) };
    const startedAt = Date.now();

    try {
      const actor = await requireAdminActor();
      requirePermission(actor, options.permission);
      if (options.mutation) {
        assertSameOriginForMutation(request);
      }
      assertRateLimit(`${actor.id}:${new URL(request.url).pathname}`);

      const input = options.parse ? await options.parse(request) : undefined;
      const ipAddress = requestIp(request);
      const userAgent = requestUserAgent(request);
      const handler = options.handler as (context: AdminRouteContext<TInput>) => Promise<TResult>;
      const result = await handler({
        request,
        actor,
        input: input as TInput,
        audit: {
          actorId: actor.id,
          requestId: meta.requestId,
          ...(ipAddress ? { ipAddress } : {}),
          ...(userAgent ? { userAgent } : {})
        }
      });

      log('info', 'admin_request_completed', {
        requestId: meta.requestId,
        route: new URL(request.url).pathname,
        method: request.method,
        userId: actor.id,
        durationMs: Date.now() - startedAt
      });
      if (result instanceof Response) {
        result.headers.set('x-request-id', meta.requestId);
        return noStore(result);
      }
      return noStore(success(result, meta, options.status));
    } catch (error) {
      log('warn', 'admin_request_rejected', {
        requestId: meta.requestId,
        route: new URL(request.url).pathname,
        method: request.method,
        durationMs: Date.now() - startedAt,
        errorCode: error instanceof Error ? error.name : 'UNKNOWN'
      });
      return noStore(failure(error, meta));
    }
  };
}
