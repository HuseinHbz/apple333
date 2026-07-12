import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { PageContainer } from '@/components/admin/page-container';
import { PimProductImportManager } from '@/components/pim/pim-product-import-manager';
import { requireAdminPagePermission } from '@/modules/auth/session';

export default async function AdminProductImportsPage() {
  const actor = await requireAdminPagePermission('product-imports.read');
  return (
    <AdminPermissionGuard permission="product-imports.read">
      <PageContainer title="ورود محصولات" description="ورود داده ابتدا مرحله‌بندی و اعتبارسنجی می‌شود؛ اعمال فقط برای batch آماده و با مجوز جداگانه انجام می‌گیرد.">
        <PimProductImportManager
          canRead={actor.permissions.has('product-imports.read')}
          canCreate={actor.permissions.has('product-imports.create')}
          canApply={actor.permissions.has('product-imports.apply')}
        />
      </PageContainer>
    </AdminPermissionGuard>
  );
}
