import { Prisma } from '@prisma/client';
import type { NotificationChannel, NotificationStatus } from '@prisma/client';

import type { CreateNotificationInput } from '@/modules/notifications/validators';
import type { AdminDatabaseClient } from '@/server/admin/database';
import { prisma } from '@/server/db/prisma';

export const notificationSelect = {
  id: true,
  recipientId: true,
  channel: true,
  priority: true,
  status: true,
  category: true,
  title: true,
  body: true,
  actionUrl: true,
  metadata: true,
  readAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NotificationSelect;

export type NotificationRecord = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

type NotificationListCriteria = Readonly<{
  page: number;
  pageSize: number;
  recipientId?: string;
  status?: NotificationStatus;
  channel?: NotificationChannel;
}>;

function toMetadata(
  metadata: CreateNotificationInput['metadata'],
): Prisma.InputJsonValue | undefined {
  return metadata === undefined ? undefined : (metadata as Prisma.InputJsonValue);
}

export const notificationRepository = {
  async findPage(
    criteria: NotificationListCriteria,
    client: AdminDatabaseClient = prisma,
  ): Promise<Readonly<{ items: readonly NotificationRecord[]; total: number }>> {
    const where: Prisma.NotificationWhereInput = {
      ...(criteria.recipientId === undefined
        ? {}
        : { recipientId: criteria.recipientId }),
      ...(criteria.status === undefined ? {} : { status: criteria.status }),
      ...(criteria.channel === undefined ? {} : { channel: criteria.channel }),
    };
    const [items, total] = await Promise.all([
      client.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (criteria.page - 1) * criteria.pageSize,
        take: criteria.pageSize,
        select: notificationSelect,
      }),
      client.notification.count({ where }),
    ]);

    return { items, total };
  },

  findById(
    notificationId: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<NotificationRecord | null> {
    return client.notification.findUnique({
      where: { id: notificationId },
      select: notificationSelect,
    });
  },

  create(
    input: CreateNotificationInput,
    client: AdminDatabaseClient = prisma,
  ): Promise<NotificationRecord> {
    const metadata = toMetadata(input.metadata);

    return client.notification.create({
      data: {
        recipient: { connect: { id: input.recipientId } },
        channel: input.channel,
        priority: input.priority,
        category: input.category,
        title: input.title,
        body: input.body,
        ...(input.actionUrl === undefined ? {} : { actionUrl: input.actionUrl }),
        ...(metadata === undefined ? {} : { metadata }),
      },
      select: notificationSelect,
    });
  },

  markRead(
    notificationId: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<NotificationRecord> {
    return client.notification.update({
      where: { id: notificationId },
      data: { status: 'READ', readAt: new Date() },
      select: notificationSelect,
    });
  },

  countPending(client: AdminDatabaseClient = prisma) {
    return client.notification.count({ where: { status: 'PENDING' } });
  },

  countUnread(client: AdminDatabaseClient = prisma) {
    return client.notification.count({ where: { readAt: null } });
  },
};
