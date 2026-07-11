import type { AdminDashboardStatusDto } from '@/server/admin/types';
import { auditLogRepository } from '@/server/repositories/audit-log-repository';
import { adminUserRepository } from '@/server/repositories/admin-user-repository';
import { mediaRepository } from '@/server/repositories/media-repository';
import { notificationRepository } from '@/server/repositories/notification-repository';
import { permissionRepository } from '@/server/repositories/permission-repository';
import { roleRepository } from '@/server/repositories/role-repository';

export async function getAdminDashboardStatus(): Promise<AdminDashboardStatusDto> {
  const [
    users,
    roles,
    permissions,
    pendingNotifications,
    unreadNotifications,
    activeMedia,
    latestAudit,
  ] = await Promise.all([
    adminUserRepository.countByStatus(),
    roleRepository.count(),
    permissionRepository.count(),
    notificationRepository.countPending(),
    notificationRepository.countUnread(),
    mediaRepository.countActive(),
    auditLogRepository.latest(),
  ]);

  return {
    generatedAt: new Date(),
    database: 'available',
    users,
    roles,
    permissions,
    pendingNotifications,
    unreadNotifications,
    activeMedia,
    latestAuditAt: latestAudit?.createdAt ?? null,
  };
}
