import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { AdminNotificationsList } from '@/components/admin/admin-resource-pages';
import { PageContainer } from '@/components/admin/page-container';
import { requireAdminPagePermission } from '@/modules/auth/session';
import { getAdminNotificationsView } from '@/server/services/admin-page-data';

export default async function AdminNotificationsPage() {
  const actor = await requireAdminPagePermission('notifications.read');
  const state = await getAdminNotificationsView();

  return (
    <AdminPermissionGuard permission="notifications.read">
      <PageContainer description="مرکز اعلان داخلی آمادهٔ اتصال به ایمیل، پیامک و Push است." title="اعلان‌ها">
        <AdminNotificationsList canUpdate={actor.permissions.has('notifications.update')} state={state} />
      </PageContainer>
    </AdminPermissionGuard>
  );
}
