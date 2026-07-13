import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { PageContainer } from '@/components/admin/page-container';
import { PimProductList } from '@/components/pim/pim-product-list';
import { Button } from '@/components/ui/button';
import { requireAdminPagePermission } from '@/modules/auth/session';
import Link from 'next/link';

export default async function AdminProductsPage() {
  const actor = await requireAdminPagePermission('products.read');
  return (
    <AdminPermissionGuard permission="products.read">
      <PageContainer
        title="محصولات"
        description="مدیریت چرخهٔ کامل محصول، تنوع‌ها، مشخصات، رسانه و وضعیت انتشار؛ همهٔ تغییرها با مجوز و رخداد ممیزی کنترل می‌شوند."
        actions={actor.permissions.has('products.create') ? <Link href="/admin/products/create"><Button>محصول جدید</Button></Link> : undefined}
      >
        <PimProductList
          canDelete={actor.permissions.has('products.delete')}
          canUpdate={actor.permissions.has('products.update')}
        />
      </PageContainer>
    </AdminPermissionGuard>
  );
}
