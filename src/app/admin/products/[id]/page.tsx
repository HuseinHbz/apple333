import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { PageContainer } from '@/components/admin/page-container';
import { PimProductEditor } from '@/components/pim/pim-product-editor';
import { requireAdminPagePermission } from '@/modules/auth/session';

export default async function AdminProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, actor] = await Promise.all([params, requireAdminPagePermission('products.read')]);
  return (
    <AdminPermissionGuard permission="products.read">
      <PageContainer title="ویرایش محصول" description="تغییرها با کنترل نسخه ذخیره می‌شوند؛ انتشار تنها پس از تکمیل دادهٔ قابل فروش مجاز است.">
        <PimProductEditor
          productId={id}
          canCreate={actor.permissions.has('products.create')}
          canUpdate={actor.permissions.has('products.update')}
          canDelete={actor.permissions.has('products.delete')}
          canPublish={actor.permissions.has('products.publish')}
        />
      </PageContainer>
    </AdminPermissionGuard>
  );
}
