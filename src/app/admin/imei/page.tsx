import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { PageContainer } from '@/components/admin/page-container';
import { DeviceUnitList } from '@/components/inventory/device-unit-list';
import { requireAdminPagePermission } from '@/modules/auth/session';

export default async function AdminImeiPage() {
  const actor = await requireAdminPagePermission('devices.read');
  return <AdminPermissionGuard permission="devices.read"><PageContainer title="IMEI و سریال" description="رهگیری دستگاه‌های اپل با کنترل دسترسی. مقادیر واقعی در این نما افشا نمی‌شوند."><DeviceUnitList canManage={actor.permissions.has('devices.manage')} /></PageContainer></AdminPermissionGuard>;
}
