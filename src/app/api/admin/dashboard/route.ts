import { withAdminRoute } from '@/server/admin/route';
import { getAdminDashboardStatus } from '@/server/services/admin-dashboard-service';

export const GET = withAdminRoute({
  permission: 'dashboard.read',
  handler: () => getAdminDashboardStatus()
});
