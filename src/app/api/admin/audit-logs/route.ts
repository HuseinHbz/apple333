import { auditLogListQuery, type AuditLogListQuery } from '@/modules/admin/validators';
import { queryParams, withAdminRoute } from '@/server/admin/route';
import { listAdminAuditLogs } from '@/server/services/audit-log-service';

export const GET = withAdminRoute<AuditLogListQuery>({
  permission: 'audit.read',
  parse: queryParams(auditLogListQuery),
  handler: ({ input }) => listAdminAuditLogs(input)
});
