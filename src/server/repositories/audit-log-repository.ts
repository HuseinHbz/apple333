import type { Prisma } from '@prisma/client';

import type { AdminDatabaseClient } from '@/server/admin/database';
import { prisma } from '@/server/db/prisma';

export const auditLogSelect = {
  id: true,
  actorId: true,
  action: true,
  entityType: true,
  entityId: true,
  requestId: true,
  ipAddress: true,
  userAgent: true,
  metadata: true,
  actor: { select: { name: true, email: true, mobile: true } },
  createdAt: true,
} satisfies Prisma.AuditLogSelect;

export type AuditLogRecord = Prisma.AuditLogGetPayload<{
  select: typeof auditLogSelect;
}>;

export type AuditLogListCriteria = Readonly<{
  page: number;
  pageSize: number;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  createdFrom?: Date;
  createdTo?: Date;
}>;

export const auditLogRepository = {
  create(
    input: Prisma.AuditLogCreateInput,
    client: AdminDatabaseClient = prisma,
  ): Promise<AuditLogRecord> {
    return client.auditLog.create({ data: input, select: auditLogSelect });
  },

  async findPage(
    criteria: AuditLogListCriteria,
    client: AdminDatabaseClient = prisma,
  ): Promise<Readonly<{ items: readonly AuditLogRecord[]; total: number }>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(criteria.actorId === undefined ? {} : { actorId: criteria.actorId }),
      ...(criteria.entityType === undefined
        ? {}
        : { entityType: { contains: criteria.entityType, mode: 'insensitive' } }),
      ...(criteria.entityId === undefined ? {} : { entityId: criteria.entityId }),
      ...(criteria.action === undefined
        ? {}
        : { action: { contains: criteria.action, mode: 'insensitive' } }),
      ...((criteria.createdFrom === undefined && criteria.createdTo === undefined)
        ? {}
        : {
          createdAt: {
            ...(criteria.createdFrom === undefined ? {} : { gte: criteria.createdFrom }),
            ...(criteria.createdTo === undefined ? {} : { lte: criteria.createdTo }),
          },
        }),
    };
    const [items, total] = await Promise.all([
      client.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (criteria.page - 1) * criteria.pageSize,
        take: criteria.pageSize,
        select: auditLogSelect,
      }),
      client.auditLog.count({ where }),
    ]);

    return { items, total };
  },

  latest(client: AdminDatabaseClient = prisma) {
    return client.auditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
  },
};
