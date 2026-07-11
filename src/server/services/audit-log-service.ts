import { toAuditLogDto } from '@/server/admin/mappers';
import { toPage } from '@/server/admin/pagination';
import type { AdminAuditLogDto, Page } from '@/server/admin/types';
import type { AuditLogListQuery } from '@/modules/admin/validators';
import { auditLogRepository } from '@/server/repositories/audit-log-repository';

export async function listAdminAuditLogs(
  query: AuditLogListQuery,
): Promise<Page<AdminAuditLogDto>> {
  const result = await auditLogRepository.findPage({
    page: query.page,
    pageSize: query.pageSize,
    ...(query.actorId === undefined ? {} : { actorId: query.actorId }),
    ...(query.entityType === undefined
      ? {}
      : { entityType: query.entityType }),
    ...(query.entityId === undefined ? {} : { entityId: query.entityId }),
    ...(query.action === undefined ? {} : { action: query.action }),
    ...(query.createdFrom === undefined ? {} : { createdFrom: query.createdFrom }),
    ...(query.createdTo === undefined ? {} : { createdTo: query.createdTo }),
  });

  return toPage(result.items.map(toAuditLogDto), query, result.total);
}
