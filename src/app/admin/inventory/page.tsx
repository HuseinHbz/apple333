import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { PageContainer } from '@/components/admin/page-container';
import { InventoryDashboard } from '@/components/inventory/inventory-dashboard';
import { requireAdminPagePermission } from '@/modules/auth/session';

export default async function AdminInventoryPage() {
  const actor = await requireAdminPagePermission('inventory.read');
  return <AdminPermissionGuard permission="inventory.read"><PageContainer title="موجودی و عملیات شعب" description="نمای واحد موجودی، رزرو، موقعیت‌های فیزیکی و حرکت‌های اتمیک بین شعب. شمارنده‌ها فقط از طریق عملیات ثبت‌شده تغییر می‌کنند."><InventoryDashboard permissions={actor.permissions} /></PageContainer></AdminPermissionGuard>;
}
