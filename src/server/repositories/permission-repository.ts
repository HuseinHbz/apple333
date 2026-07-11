import type { Prisma } from '@prisma/client';

import type { AdminDatabaseClient } from '@/server/admin/database';
import { prisma } from '@/server/db/prisma';

export const permissionSelect = {
  id: true,
  code: true,
  group: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PermissionSelect;

export type PermissionRecord = Prisma.PermissionGetPayload<{
  select: typeof permissionSelect;
}>;

export const permissionRepository = {
  list(client: AdminDatabaseClient = prisma): Promise<PermissionRecord[]> {
    return client.permission.findMany({
      orderBy: [{ group: 'asc' }, { code: 'asc' }],
      select: permissionSelect,
    });
  },

  findByIds(
    permissionIds: readonly string[],
    client: AdminDatabaseClient = prisma,
  ): Promise<PermissionRecord[]> {
    return client.permission.findMany({
      where: { id: { in: [...permissionIds] } },
      orderBy: { code: 'asc' },
      select: permissionSelect,
    });
  },

  count(client: AdminDatabaseClient = prisma) {
    return client.permission.count();
  },
};
