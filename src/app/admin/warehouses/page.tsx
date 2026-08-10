import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { PageContainer } from '@/components/admin/page-container';
import { WarehouseManager } from '@/components/inventory/warehouse-manager';
import { requireAdminPagePermission } from '@/modules/auth/session';

export default async function AdminWarehousesPage() {
  const actor = await requireAdminPagePermission('warehouses.read');
  return <AdminPermissionGuard permission="warehouses.read"><PageContainer title="انبارها و موقعیت‌ها" description="هر انبار به یک شعبه متصل است و حداقل یک موقعیت فیزیکی برای دریافت، نگهداری یا تحویل دارد."><WarehouseManager canCreate={actor.permissions.has('warehouses.create')} canUpdate={actor.permissions.has('warehouses.update')} /></PageContainer></AdminPermissionGuard>;
}
