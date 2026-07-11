import { NotFoundError } from '@/server/errors/app-error';
import { auditInput, requireAuditContext } from '@/server/admin/audit';
import { toNotificationDto } from '@/server/admin/mappers';
import { toPage } from '@/server/admin/pagination';
import type {
  AdminAuditContext,
  AdminNotificationDto,
  Page,
} from '@/server/admin/types';
import type {
  CreateNotificationInput,
  NotificationListQuery,
} from '@/modules/notifications/validators';
import { prisma } from '@/server/db/prisma';
import { auditLogRepository } from '@/server/repositories/audit-log-repository';
import { adminUserRepository } from '@/server/repositories/admin-user-repository';
import { notificationRepository } from '@/server/repositories/notification-repository';

export async function listAdminNotifications(
  query: NotificationListQuery,
): Promise<Page<AdminNotificationDto>> {
  const result = await notificationRepository.findPage({
    page: query.page,
    pageSize: query.pageSize,
    ...(query.recipientId === undefined
      ? {}
      : { recipientId: query.recipientId }),
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(query.channel === undefined ? {} : { channel: query.channel }),
  });

  return toPage(result.items.map(toNotificationDto), query, result.total);
}

export async function createAdminNotification(
  input: CreateNotificationInput,
  context: AdminAuditContext,
): Promise<AdminNotificationDto> {
  const auditContext = requireAuditContext(context);

  return prisma.$transaction(async (transaction) => {
    const recipient = await adminUserRepository.findDetailById(
      input.recipientId,
      transaction,
    );
    if (recipient === null) {
      throw new NotFoundError();
    }

    const notification = await notificationRepository.create(input, transaction);
    await auditLogRepository.create(
      auditInput(auditContext, {
        action: 'admin.notification.created',
        entityType: 'Notification',
        entityId: notification.id,
        metadata: {
          recipientId: notification.recipientId,
          channel: notification.channel,
          priority: notification.priority,
          category: notification.category,
        },
      }),
      transaction,
    );

    return toNotificationDto(notification);
  });
}

export async function markAdminNotificationRead(
  notificationId: string,
  context: AdminAuditContext,
): Promise<AdminNotificationDto> {
  const auditContext = requireAuditContext(context);

  return prisma.$transaction(async (transaction) => {
    const existing = await notificationRepository.findById(
      notificationId,
      transaction,
    );
    if (existing === null) {
      throw new NotFoundError();
    }

    const notification = await notificationRepository.markRead(
      notificationId,
      transaction,
    );
    await auditLogRepository.create(
      auditInput(auditContext, {
        action: 'admin.notification.read',
        entityType: 'Notification',
        entityId: notification.id,
        metadata: { previousStatus: existing.status },
      }),
      transaction,
    );

    return toNotificationDto(notification);
  });
}
