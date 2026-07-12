import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { PageContainer } from '@/components/admin/page-container';
import { PimCategoryManager } from '@/components/pim/pim-reference-managers';
import { requireAdminPagePermission } from '@/modules/auth/session';

export default async function AdminCategoriesPage() {
  const actor = await requireAdminPagePermission('categories.read');
  return (
    <AdminPermissionGuard permission="categories.read">
      <PageContainer title="دسته‌بندی‌ها" description="درخت دسته‌بندی، SEO و اولویت نمایش کاتالوگ را با کنترل چرخهٔ وابستگی مدیریت کنید.">
        <PimCategoryManager
          canCreate={actor.permissions.has('categories.create')}
          canUpdate={actor.permissions.has('categories.update')}
          canDelete={actor.permissions.has('categories.delete')}
        />
      </PageContainer>
    </AdminPermissionGuard>
  );
}
