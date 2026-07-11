import type {
  AdminAuditActivity,
  AdminAuditRow,
  AdminDashboardData,
  AdminDataState,
  AdminListPageData,
  AdminMediaRow,
  AdminNotificationRow,
  AdminPermissionRow,
  AdminRoleRow,
  AdminSettingRow,
  AdminUserDetail,
  AdminUserRow
} from '@/modules/admin/types';
import type { AdminUserListQuery, AuditLogListQuery } from '@/modules/admin/validators';
import { prisma } from '@/server/db/prisma';
import { cache } from '@/server/cache/redis';
import { getAdminDashboardStatus } from '@/server/services/admin-dashboard-service';
import { getAdminUser, listAdminUsers } from '@/server/services/admin-user-service';
import { listAdminAuditLogs } from '@/server/services/audit-log-service';
import { listAdminMedia } from '@/server/services/media-service';
import { listAdminNotifications } from '@/server/services/notification-service';
import { listAdminPermissions } from '@/server/services/permission-service';
import { listAdminRoles } from '@/server/services/role-service';
import { listAdminSettings } from '@/server/services/setting-service';

const unavailableReason = 'دادهٔ این بخش تا زمان آماده‌بودن سرویس یا اتصال دیتابیس قابل نمایش نیست.';

function date(value: Date): string {
  return value.toISOString();
}

function unavailable<T>(): AdminDataState<T> {
  return { kind: 'unavailable', reason: unavailableReason };
}

function activityFromAudit(item: {
  id: string;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: Date;
}): AdminAuditActivity {
  return {
    id: item.id,
    actorName: item.actorName,
    action: item.action,
    resource: item.entityId ? `${item.entityType}:${item.entityId}` : item.entityType,
    createdAt: date(item.createdAt)
  };
}

function page<T>(items: readonly T[], pageNumber: number, pageSize: number, total: number): AdminDataState<AdminListPageData<T>> {
  if (total === 0) {
    return { kind: 'empty' };
  }
  return { kind: 'ready', data: { rows: items, page: pageNumber, pageSize, total } };
}

export async function getAdminDashboardView(): Promise<AdminDataState<AdminDashboardData>> {
  try {
    const [dashboard, audit, redisAvailable] = await Promise.all([
      getAdminDashboardStatus(),
      listAdminAuditLogs({ page: 1, pageSize: 5 }),
      cache.ping()
    ]);
    const users = dashboard.users.active + dashboard.users.inactive + dashboard.users.suspended;

    return {
      kind: 'ready',
      data: {
        metrics: [
          { id: 'users', label: 'کاربران', value: users, format: 'number', description: 'تعداد واقعی حساب‌های ثبت‌شده' },
          { id: 'orders', label: 'سفارش‌ها', value: null, format: 'number', description: 'ماژول سفارش هنوز داده‌ای منتشر نمی‌کند' },
          { id: 'revenue', label: 'درآمد', value: null, format: 'currency', description: 'ماژول مالی هنوز داده‌ای منتشر نمی‌کند' },
          { id: 'products', label: 'محصولات', value: null, format: 'number', description: 'کاتالوگ هنوز داده‌ای منتشر نمی‌کند' }
        ],
        system: [
          { id: 'server', label: 'Server', status: 'healthy', detail: 'Next.js route handlers are available.' },
          { id: 'database', label: 'Database', status: dashboard.database === 'available' ? 'healthy' : 'unavailable', detail: 'Prisma read checks completed.' },
          { id: 'redis', label: 'Redis', status: redisAvailable ? 'healthy' : 'unknown', detail: redisAvailable ? 'Cache adapter responded.' : 'Cache adapter is not configured.' },
          { id: 'queue', label: 'Queue', status: 'unknown', detail: 'Queue adapter is not configured.' }
        ],
        activities: audit.items.map(activityFromAudit)
      }
    };
  } catch {
    return unavailable();
  }
}

export async function getAdminUsersView(
  query: AdminUserListQuery = { page: 1, pageSize: 25 },
): Promise<AdminDataState<AdminListPageData<AdminUserRow>>> {
  try {
    const result = await listAdminUsers(query);
    return page(result.items.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      status: user.status,
      roles: user.roles.map((role) => role.code),
      createdAt: date(user.createdAt)
    })), result.page, result.pageSize, result.total);
  } catch {
    return unavailable();
  }
}

export async function getAdminUserDetailView(userId: string): Promise<AdminDataState<AdminUserDetail>> {
  try {
    const [user, audit, permissions] = await Promise.all([
      getAdminUser(userId),
      listAdminAuditLogs({ page: 1, pageSize: 10, actorId: userId }),
      prisma.userRole.findMany({
        where: { userId },
        select: { role: { select: { permissions: { select: { permission: { select: { code: true } } } } } } }
      })
    ]);
    const effectivePermissions = [...new Set(permissions.flatMap((assignment) =>
      assignment.role.permissions.map((rolePermission) => rolePermission.permission.code)
    ))].sort();

    return {
      kind: 'ready',
      data: {
        user: {
          id: user.id,
          name: user.name ?? ([user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(' ') || null),
          email: user.email,
          mobile: user.mobile,
          status: user.status,
          roles: user.roles.map((role) => role.code),
          createdAt: date(user.createdAt)
        },
        effectivePermissions,
        activity: audit.items.map(activityFromAudit)
      }
    };
  } catch {
    return unavailable();
  }
}

export async function getAdminRolesView(): Promise<AdminDataState<AdminListPageData<AdminRoleRow>>> {
  try {
    const [roles, usage] = await Promise.all([
      listAdminRoles(),
      prisma.userRole.groupBy({ by: ['roleId'], _count: { _all: true } })
    ]);
    const usersByRole = new Map(usage.map((entry) => [entry.roleId, entry._count._all]));
    return page(roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissionCount: role.permissions.length,
      userCount: usersByRole.get(role.id) ?? 0,
      updatedAt: date(role.updatedAt)
    })), 1, 100, roles.length);
  } catch {
    return unavailable();
  }
}

export async function getAdminPermissionsView(): Promise<AdminDataState<AdminListPageData<AdminPermissionRow>>> {
  try {
    const [permissions, usage] = await Promise.all([
      listAdminPermissions(),
      prisma.rolePermission.groupBy({ by: ['permissionId'], _count: { _all: true } })
    ]);
    const rolesByPermission = new Map(usage.map((entry) => [entry.permissionId, entry._count._all]));
    return page(permissions.map((permission) => ({
      id: permission.id,
      code: permission.code,
      group: permission.group,
      description: permission.description,
      roleCount: rolesByPermission.get(permission.id) ?? 0
    })), 1, 100, permissions.length);
  } catch {
    return unavailable();
  }
}

export async function getAdminSettingsView(): Promise<AdminDataState<AdminListPageData<AdminSettingRow>>> {
  try {
    const settings = await listAdminSettings();
    return page(settings.map((setting) => ({
      id: setting.id,
      key: setting.key,
      category: setting.category,
      version: setting.version,
      updatedAt: date(setting.updatedAt),
      isSensitive: setting.isSensitive
    })), 1, 100, settings.length);
  } catch {
    return unavailable();
  }
}

export async function getAdminMediaView(): Promise<AdminDataState<AdminListPageData<AdminMediaRow>>> {
  try {
    const result = await listAdminMedia({ page: 1, pageSize: 25, includeDeleted: false });
    return page(result.items.map((media) => ({
      id: media.id,
      originalName: media.originalName,
      contentType: media.contentType,
      kind: media.kind,
      bytes: media.bytes,
      url: media.url,
      metadata: media.metadata,
      createdAt: date(media.createdAt)
    })), result.page, result.pageSize, result.total);
  } catch {
    return unavailable();
  }
}

export async function getAdminNotificationsView(): Promise<AdminDataState<AdminListPageData<AdminNotificationRow>>> {
  try {
    const result = await listAdminNotifications({ page: 1, pageSize: 25 });
    return page(result.items.map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      category: notification.category,
      channel: notification.channel,
      priority: notification.priority,
      status: notification.status,
      createdAt: date(notification.createdAt)
    })), result.page, result.pageSize, result.total);
  } catch {
    return unavailable();
  }
}

export async function getAdminAuditLogsView(
  query: AuditLogListQuery = { page: 1, pageSize: 25 },
): Promise<AdminDataState<AdminListPageData<AdminAuditRow>>> {
  try {
    const result = await listAdminAuditLogs(query);
    return page(result.items.map((audit) => ({
      id: audit.id,
          actorName: audit.actorName,
      action: audit.action,
      entityType: audit.entityType,
      entityId: audit.entityId,
      requestId: audit.requestId,
      ipAddress: audit.ipAddress,
      createdAt: date(audit.createdAt)
    })), result.page, result.pageSize, result.total);
  } catch {
    return unavailable();
  }
}
