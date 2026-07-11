import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { AdminAuditList } from '@/components/admin/admin-resource-pages';
import { PageContainer } from '@/components/admin/page-container';
import { requireAdminPagePermission } from '@/modules/auth/session';
import { auditLogListQuery } from '@/modules/admin/validators';
import { getAdminAuditLogsView } from '@/server/services/admin-page-data';

export default async function AdminAuditLogsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPagePermission('audit.read');
  const params = await searchParams;
  const parsed = auditLogListQuery.safeParse({
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
    actorId: typeof params.actorId === 'string' ? params.actorId : undefined,
    entityType: typeof params.entityType === 'string' ? params.entityType : undefined,
    entityId: typeof params.entityId === 'string' ? params.entityId : undefined,
    action: typeof params.action === 'string' ? params.action : undefined,
    createdFrom: typeof params.createdFrom === 'string' ? params.createdFrom : undefined,
    createdTo: typeof params.createdTo === 'string' ? params.createdTo : undefined,
  });
  const state = await getAdminAuditLogsView(parsed.success ? parsed.data : { page: 1, pageSize: 25 });

  return (
    <AdminPermissionGuard permission="audit.read">
      <PageContainer description="رویدادها صرفاً خواندنی هستند و شامل کاربر، عمل، منبع، زمان، IP و شناسهٔ درخواست می‌شوند." title="رویدادهای ممیزی">
        <AdminAuditList state={state} />
      </PageContainer>
    </AdminPermissionGuard>
  );
}
