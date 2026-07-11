import { AdminPermissionGuard } from '@/components/admin/admin-permission-guard';
import { AdminUsersList } from '@/components/admin/admin-resource-pages';
import { PageContainer } from '@/components/admin/page-container';
import { requireAdminPagePermission } from '@/modules/auth/session';
import { adminUserListQuery } from '@/modules/admin/validators';
import { getAdminUsersView } from '@/server/services/admin-page-data';

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireAdminPagePermission('users.read');
  const params = await searchParams;
  const parsed = adminUserListQuery.safeParse({
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
    query: typeof params.query === 'string' ? params.query : undefined,
    status: typeof params.status === 'string' ? params.status : undefined,
  });
  const state = await getAdminUsersView(parsed.success ? parsed.data : { page: 1, pageSize: 25 });

  return (
    <AdminPermissionGuard permission="users.read">
      <PageContainer description="مدیریت کاربران، وضعیت حساب‌ها و نقش‌های تخصیص‌یافته؛ داده‌های حساس هرگز در این نما نمایش داده نمی‌شوند." title="کاربران">
        <AdminUsersList
          canAssignRole={actor.permissions.has('users.update') && actor.permissions.has('roles.read')}
          canManage={actor.permissions.has('users.update')}
          state={state}
        />
      </PageContainer>
    </AdminPermissionGuard>
  );
}
