import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { AdminMediaList, AdminMediaUploadFoundation } from '@/components/admin/admin-resource-pages';
import { PageContainer } from '@/components/admin/page-container';
import { requireAdminPagePermission } from '@/modules/auth/session';
import { getAdminMediaView } from '@/server/services/admin-page-data';

export default async function AdminMediaPage() {
  const actor = await requireAdminPagePermission('media.read');
  const state = await getAdminMediaView();

  return (
    <AdminPermissionGuard permission="media.read">
      <PageContainer description="مدیریت فایل‌های تصویر، ویدئو و سند با لایهٔ ذخیره‌سازی قابل تعویض." title="کتابخانه رسانه">
        <div className="space-y-6">
          <AdminMediaUploadFoundation canUpload={actor.permissions.has('media.create')} />
          <AdminMediaList canDelete={actor.permissions.has('media.delete')} state={state} />
        </div>
      </PageContainer>
    </AdminPermissionGuard>
  );
}
