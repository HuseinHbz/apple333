import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { AdminSettingsList } from '@/components/admin/admin-resource-pages';
import { PageContainer } from '@/components/admin/page-container';
import { requireAdminPagePermission } from '@/modules/auth/session';
import { getAdminSettingsView } from '@/server/services/admin-page-data';

export default async function AdminSettingsPage() {
  const actor = await requireAdminPagePermission('settings.read');
  const state = await getAdminSettingsView();

  return (
    <AdminPermissionGuard permission="settings.read">
      <PageContainer description="تنظیمات عمومی، امنیت، اعلان، ذخیره‌سازی و برنامه با نسخه و سابقهٔ ممیزی نگهداری می‌شوند." title="تنظیمات سیستم">
        <AdminSettingsList canUpdate={actor.permissions.has('settings.update')} state={state} />
      </PageContainer>
    </AdminPermissionGuard>
  );
}
