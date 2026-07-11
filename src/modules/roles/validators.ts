import { z } from 'zod';

const cuid = z.string().cuid();
const roleCode = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]{1,63}$/);
const roleName = z.string().trim().min(2).max(120);
const description = z.string().trim().min(1).max(500).nullable();

export const createRoleInput = z.object({
  code: roleCode,
  name: roleName,
  description: description.optional(),
  permissionIds: z.array(cuid).max(100).default([]),
});

export const updateRoleInput = z
  .object({
    name: roleName.optional(),
    description: description.optional(),
  })
  .refine((value) => value.name !== undefined || value.description !== undefined, {
    message: 'At least one role field must be supplied.',
  });

export const replaceRolePermissionsInput = z.object({
  permissionIds: z.array(cuid).max(100),
});

export type CreateRoleInput = z.infer<typeof createRoleInput>;
export type UpdateRoleInput = z.infer<typeof updateRoleInput>;
export type ReplaceRolePermissionsInput = z.infer<
  typeof replaceRolePermissionsInput
>;
