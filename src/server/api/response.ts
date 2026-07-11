import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { AppError, ValidationError } from '@/server/errors/app-error';

export type ApiMeta = { requestId: string };

const requestIdPattern = /^[A-Za-z0-9._-]{8,128}$/;

export function requestId(request: Request): string {
  const candidate = request.headers.get('x-request-id');
  return candidate && requestIdPattern.test(candidate) ? candidate : crypto.randomUUID();
}

export function success<T>(data: T, meta: ApiMeta, status = 200): NextResponse {
  return NextResponse.json(
    { success: true, data, meta },
    { status, headers: { 'x-request-id': meta.requestId } }
  );
}

export function failure(error: unknown, meta: ApiMeta): NextResponse {
  const known = error instanceof ZodError
    ? new ValidationError(Object.fromEntries(error.issues.map((issue) => [issue.path.join('.') || 'root', issue.message])))
    : error instanceof AppError
      ? error
      : new AppError('INTERNAL_ERROR', 500, 'An unexpected error occurred.');

  return NextResponse.json(
    {
      success: false,
      error: {
        code: known.code,
        message: known.clientMessage,
        fields: known.metadata
      },
      meta
    },
    { status: known.status, headers: { 'x-request-id': meta.requestId } }
  );
}
