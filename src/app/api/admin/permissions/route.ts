import { withAdminRoute } from '@/server/admin/route';
import { listAdminPermissions } from '@/server/services/permission-service';

export const GET = withAdminRoute({
  permission: 'permissions.read',
  handler: () => listAdminPermissions()
});
