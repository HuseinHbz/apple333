import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { PageContainer } from '@/components/admin/page-container';
import { PimWarrantyManager } from '@/components/pim/pim-reference-managers';
import { requireAdminPagePermission } from '@/modules/auth/session';

export default async function AdminWarrantiesPage() {
  const actor = await requireAdminPagePermission('warranties.read');
  return (
    <AdminPermissionGuard permission="warranties.read">
      <PageContainer title="گارانتی‌ها" description="شرایط، ارائه‌دهنده و مدت گارانتی تنوع‌های کالا را در یک مرجع معتبر نگه دارید.">
        <PimWarrantyManager
          canCreate={actor.permissions.has('warranties.create')}
          canUpdate={actor.permissions.has('warranties.update')}
          canDelete={actor.permissions.has('warranties.delete')}
        />
      </PageContainer>
    </AdminPermissionGuard>
  );
}
