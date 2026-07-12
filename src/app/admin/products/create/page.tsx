import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { PageContainer } from '@/components/admin/page-container';
import { PimProductEditor } from '@/components/pim/pim-product-editor';
import { requireAdminPagePermission } from '@/modules/auth/session';

export default async function CreateAdminProductPage() {
  const actor = await requireAdminPagePermission('products.create');
  return (
    <AdminPermissionGuard permission="products.create">
      <PageContainer title="محصول جدید" description="ابتدا هویت محصول و SEO را ثبت کنید، سپس تنوع، مشخصات و رسانه را در صفحهٔ محصول تکمیل کنید.">
        <PimProductEditor canCreate={actor.permissions.has('products.create')} />
      </PageContainer>
    </AdminPermissionGuard>
  );
}
