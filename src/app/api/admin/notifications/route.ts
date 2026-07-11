import { notificationListQuery, createNotificationInput, type CreateNotificationInput, type NotificationListQuery } from '@/modules/notifications/validators';
import { jsonBody, queryParams, withAdminRoute } from '@/server/admin/route';
import { createAdminNotification, listAdminNotifications } from '@/server/services/notification-service';

export const GET = withAdminRoute<NotificationListQuery>({
  permission: 'notifications.read',
  parse: queryParams(notificationListQuery),
  handler: ({ input }) => listAdminNotifications(input)
});

export const POST = withAdminRoute<CreateNotificationInput>({
  permission: 'notifications.update',
  mutation: true,
  status: 201,
  parse: jsonBody(createNotificationInput),
  handler: ({ input, audit }) => createAdminNotification(input, audit)
});
