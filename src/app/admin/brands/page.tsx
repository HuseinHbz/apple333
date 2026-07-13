import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { PageContainer } from '@/components/admin/page-container';
import { PimBrandManager } from '@/components/pim/pim-reference-managers';
import { requireAdminPagePermission } from '@/modules/auth/session';

export default async function AdminBrandsPage() {
  const actor = await requireAdminPagePermission('brands.read');
  return (
    <AdminPermissionGuard permission="brands.read">
      <PageContainer title="برندها" description="کاتالوگ برند، هویت، لوگو و وضعیت فعال‌بودن را بدون شکستن دادهٔ قدیمی مدیریت کنید.">
        <PimBrandManager
          canCreate={actor.permissions.has('brands.create')}
          canUpdate={actor.permissions.has('brands.update')}
          canDelete={actor.permissions.has('brands.delete')}
        />
      </PageContainer>
    </AdminPermissionGuard>
  );
}
