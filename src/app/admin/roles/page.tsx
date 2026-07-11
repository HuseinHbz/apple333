import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { AdminRolesList } from '@/components/admin/admin-resource-pages';
import { PageContainer } from '@/components/admin/page-container';
import { requireAdminPagePermission } from '@/modules/auth/session';
import { getAdminRolesView } from '@/server/services/admin-page-data';

export default async function AdminRolesPage() {
  const actor = await requireAdminPagePermission('roles.read');
  const state = await getAdminRolesView();

  return (
    <AdminPermissionGuard permission="roles.read">
      <PageContainer description="تعریف نقش، اختصاص مجوز و محافظت از نقش‌های سیستمی از این بخش مدیریت می‌شود." title="نقش‌ها">
        <AdminRolesList
          canCreate={actor.permissions.has('roles.create')}
          canDelete={actor.permissions.has('roles.delete')}
          canUpdate={actor.permissions.has('roles.update')}
          state={state}
        />
      </PageContainer>
    </AdminPermissionGuard>
  );
}
