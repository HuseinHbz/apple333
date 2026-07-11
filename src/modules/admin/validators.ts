import { z } from 'zod';

const cuid = z.string().cuid();

export const paginationInput = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const userStatusInput = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']);

export const adminUserListQuery = paginationInput.extend({
  query: z.string().trim().min(1).max(120).optional(),
  status: userStatusInput.optional(),
});

export const updateAdminUserStatusInput = z.object({
  userId: cuid,
  status: userStatusInput,
});

export const assignAdminUserRoleInput = z.object({
  userId: cuid,
  roleId: cuid,
});

export const auditLogListQuery = paginationInput.extend({
  actorId: cuid.optional(),
  entityType: z.string().trim().min(1).max(80).optional(),
  entityId: z.string().trim().min(1).max(128).optional(),
  action: z.string().trim().min(1).max(120).optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
}).refine(
  (value) => !value.createdFrom || !value.createdTo || value.createdFrom <= value.createdTo,
  { message: 'createdFrom must be earlier than createdTo.', path: ['createdTo'] }
);

export type PaginationInput = z.infer<typeof paginationInput>;
export type AdminUserListQuery = z.infer<typeof adminUserListQuery>;
export type UpdateAdminUserStatusInput = z.infer<
  typeof updateAdminUserStatusInput
>;
export type AssignAdminUserRoleInput = z.infer<
  typeof assignAdminUserRoleInput
>;
export type AuditLogListQuery = z.infer<typeof auditLogListQuery>;
