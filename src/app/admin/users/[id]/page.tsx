import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { AdminUserDetailView } from '@/components/admin/admin-resource-pages';
import { PageContainer } from '@/components/admin/page-container';
import { requireAdminPagePermission } from '@/modules/auth/session';
import { getAdminUserDetailView } from '@/server/services/admin-page-data';

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPagePermission('users.read');
  const state = await getAdminUserDetailView(id);

  return (
    <AdminPermissionGuard permission="users.read">
      <PageContainer description={`شناسهٔ کاربر: ${id}`} title="جزئیات کاربر">
        <AdminUserDetailView state={state} />
      </PageContainer>
    </AdminPermissionGuard>
  );
}
