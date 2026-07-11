import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { AdminPermissionsList } from '@/components/admin/admin-resource-pages';
import { PageContainer } from '@/components/admin/page-container';
import { requireAdminPagePermission } from '@/modules/auth/session';
import { getAdminPermissionsView } from '@/server/services/admin-page-data';

export default async function AdminPermissionsPage() {
  await requireAdminPagePermission('permissions.read');
  const state = await getAdminPermissionsView();

  return (
    <AdminPermissionGuard permission="permissions.read">
      <PageContainer description="مجوزها با الگوی resource.action گروه‌بندی می‌شوند و فقط از مسیر نقش‌ها تخصیص می‌یابند." title="مجوزها">
        <AdminPermissionsList state={state} />
      </PageContainer>
    </AdminPermissionGuard>
  );
}
