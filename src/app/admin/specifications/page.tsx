import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { PageContainer } from '@/components/admin/page-container';
import { PimSpecificationsManager } from '@/components/pim/pim-specifications-manager';
import { requireAdminPagePermission } from '@/modules/auth/session';

export default async function AdminSpecificationsPage() {
  const actor = await requireAdminPagePermission('attributes.read');
  return (
    <AdminPermissionGuard permission="attributes.read">
      <PageContainer title="مشخصات کاتالوگ" description="گروه‌ها و ویژگی‌های ساخت‌یافته برای جست‌وجو، فیلتر، مقایسه و صفحهٔ محصول.">
        <PimSpecificationsManager
          canCreate={actor.permissions.has('attributes.create')}
          canUpdate={actor.permissions.has('attributes.update')}
          canDelete={actor.permissions.has('attributes.delete')}
        />
      </PageContainer>
    </AdminPermissionGuard>
  );
}
