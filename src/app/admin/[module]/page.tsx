import { notFound, redirect } from 'next/navigation';
import { AdminPlannedModule } from '@/components/admin/admin-resource-pages';
import { PageContainer } from '@/components/admin/page-container';
import { findAdminNavigationItem } from '@/modules/admin/navigation.config';
import { requireAdminPageActor } from '@/modules/auth/session';
import { canAccessAdminRoute, type Permission } from '@/server/security/permissions';

export default async function AdminPlannedModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const item = findAdminNavigationItem(`/admin/${module}`);
  if (!item || item.availability !== 'planned') notFound();

  const actor = await requireAdminPageActor();
  if (item.permission && !canAccessAdminRoute(actor, item.permission as Permission)) redirect('/admin/access-denied');

  return (
    <PageContainer description="این ماژول در نقشهٔ راه پلتفرم تعریف شده و رابط مدیریت آن برای اتصال به سرویس‌های فاز بعد آماده است." title={item.label}>
      <AdminPlannedModule description="تا زمان اجرای سرویس، API، مدل داده و تست‌های اختصاصی این ماژول، داده یا کنترل نمایشی ارائه نمی‌شود." title={item.label} />
    </PageContainer>
  );
}
