import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { PageContainer } from '@/components/admin/page-container';
import { BranchManager } from '@/components/inventory/branch-manager';
import { requireAdminPagePermission } from '@/modules/auth/session';

export default async function AdminBranchesPage() {
  const actor = await requireAdminPagePermission('branches.read');
  return <AdminPermissionGuard permission="branches.read"><PageContainer title="شعب" description="شعبه‌های فروشگاهی و انبار مرکزی را بدون حذف تاریخچهٔ موجودی مدیریت کنید."><BranchManager canCreate={actor.permissions.has('branches.create')} canUpdate={actor.permissions.has('branches.update')} /></PageContainer></AdminPermissionGuard>;
}
