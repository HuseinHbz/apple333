import { z } from 'zod';

import { jsonValueInput } from '@/modules/settings/validators';

const cuid = z.string().cuid();

export const notificationChannelInput = z.enum(['INTERNAL', 'EMAIL', 'SMS', 'PUSH']);
export const notificationPriorityInput = z.enum([
  'LOW',
  'NORMAL',
  'HIGH',
  'CRITICAL',
]);
export const notificationStatusInput = z.enum([
  'PENDING',
  'SENT',
  'READ',
  'FAILED',
]);

export const createNotificationInput = z.object({
  recipientId: cuid,
  channel: notificationChannelInput.default('INTERNAL'),
  priority: notificationPriorityInput.default('NORMAL'),
  category: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(180),
  body: z.string().trim().min(1).max(4_000),
  actionUrl: z.string().url().max(2_048).optional(),
  metadata: z.record(jsonValueInput).optional(),
});

export const notificationListQuery = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  recipientId: cuid.optional(),
  status: notificationStatusInput.optional(),
  channel: notificationChannelInput.optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationInput>;
export type NotificationListQuery = z.infer<typeof notificationListQuery>;
