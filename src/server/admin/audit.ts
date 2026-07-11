import type { Prisma } from '@prisma/client';

import { ValidationError } from '@/server/errors/app-error';

import type { AdminAuditContext } from './types';

export function requireAuditContext(
  context: AdminAuditContext,
): AdminAuditContext {
  const fields: Record<string, string> = {};

  if (!context.actorId.trim()) {
    fields.actorId = 'Actor id is required.';
  }

  if (!context.requestId.trim()) {
    fields.requestId = 'Request id is required.';
  }

  if (Object.keys(fields).length > 0) {
    throw new ValidationError(fields);
  }

  return context;
}

export function auditInput(
  context: AdminAuditContext,
  input: Readonly<{
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }>,
): Prisma.AuditLogCreateInput {
  const auditContext = requireAuditContext(context);

  return {
    actor: { connect: { id: auditContext.actorId } },
    action: input.action,
    entityType: input.entityType,
    ...(input.entityId === undefined ? {} : { entityId: input.entityId }),
    requestId: auditContext.requestId,
    ...(auditContext.ipAddress === undefined
      ? {}
      : { ipAddress: auditContext.ipAddress }),
    ...(auditContext.userAgent === undefined
      ? {}
      : { userAgent: auditContext.userAgent }),
    ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
  };
}
