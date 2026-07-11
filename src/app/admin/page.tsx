import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { PageContainer } from '@/components/admin/page-container';
import { requireAdminPagePermission } from '@/modules/auth/session';
import { getAdminDashboardView } from '@/server/services/admin-page-data';

export default async function AdminPage() {
  await requireAdminPagePermission('dashboard.read');
  const state = await getAdminDashboardView();

  return (
    <PageContainer description="نمای کلی مدیریت، زیرساخت و رویدادهای قابل ممیزی." title="داشبورد">
      <AdminDashboard state={state} />
    </PageContainer>
  );
}
