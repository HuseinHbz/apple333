import type { Prisma } from '@prisma/client';

import type { AdminDatabaseClient } from '@/server/admin/database';
import { prisma } from '@/server/db/prisma';

const permissionSelect = {
  id: true,
  code: true,
  group: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PermissionSelect;

export const roleDetailSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  isSystem: true,
  permissions: {
    orderBy: { permissionId: 'asc' },
    select: { permission: { select: permissionSelect } },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RoleSelect;

export type RoleDetailRecord = Prisma.RoleGetPayload<{
  select: typeof roleDetailSelect;
}>;

type RoleCreateData = Readonly<{
  code: string;
  name: string;
  description?: string | null;
}>;

type RoleUpdateData = Readonly<{
  name?: string | undefined;
  description?: string | null | undefined;
}>;

export const roleRepository = {
  list(client: AdminDatabaseClient = prisma): Promise<RoleDetailRecord[]> {
    return client.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      select: roleDetailSelect,
    });
  },

  findById(
    roleId: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<RoleDetailRecord | null> {
    return client.role.findUnique({
      where: { id: roleId },
      select: roleDetailSelect,
    });
  },

  findByCode(
    code: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<RoleDetailRecord | null> {
    return client.role.findUnique({
      where: { code },
      select: roleDetailSelect,
    });
  },

  create(
    input: RoleCreateData,
    client: AdminDatabaseClient = prisma,
  ): Promise<RoleDetailRecord> {
    return client.role.create({
      data: {
        code: input.code,
        name: input.name,
        ...(input.description === undefined
          ? {}
          : { description: input.description }),
      },
      select: roleDetailSelect,
    });
  },

  update(
    roleId: string,
    input: RoleUpdateData,
    client: AdminDatabaseClient = prisma,
  ): Promise<RoleDetailRecord> {
    return client.role.update({
      where: { id: roleId },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined
          ? {}
          : { description: input.description }),
      },
      select: roleDetailSelect,
    });
  },

  async replacePermissions(
    roleId: string,
    permissionIds: readonly string[],
    client: AdminDatabaseClient = prisma,
  ): Promise<RoleDetailRecord> {
    await client.rolePermission.deleteMany({ where: { roleId } });

    if (permissionIds.length > 0) {
      await client.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true,
      });
    }

    return client.role.findUniqueOrThrow({
      where: { id: roleId },
      select: roleDetailSelect,
    });
  },

  async delete(roleId: string, client: AdminDatabaseClient = prisma) {
    await client.rolePermission.deleteMany({ where: { roleId } });
    return client.role.delete({ where: { id: roleId } });
  },

  countAssignedUsers(roleId: string, client: AdminDatabaseClient = prisma) {
    return client.userRole.count({ where: { roleId } });
  },

  count(client: AdminDatabaseClient = prisma) {
    return client.role.count();
  },
};
