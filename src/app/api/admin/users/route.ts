import { adminUserListQuery, type AdminUserListQuery } from '@/modules/admin/validators';
import { queryParams, withAdminRoute } from '@/server/admin/route';
import { listAdminUsers } from '@/server/services/admin-user-service';

export const GET = withAdminRoute<AdminUserListQuery>({
  permission: 'users.read',
  parse: queryParams(adminUserListQuery),
  handler: ({ input }) => listAdminUsers(input)
});
