import type { Prisma, UserStatus } from '@prisma/client';

import type { AdminDatabaseClient } from '@/server/admin/database';
import { prisma } from '@/server/db/prisma';

export type AdminUserListCriteria = Readonly<{
  page: number;
  pageSize: number;
  query?: string;
  status?: UserStatus;
}>;

const roleSummarySelect = {
  id: true,
  code: true,
  name: true,
  isSystem: true,
} satisfies Prisma.RoleSelect;

const adminProfileSummarySelect = {
  branchId: true,
  isActive: true,
  lastLoginAt: true,
} satisfies Prisma.AdminUserSelect;

export const adminUserListSelect = {
  id: true,
  name: true,
  image: true,
  email: true,
  mobile: true,
  status: true,
  roles: {
    orderBy: { assignedAt: 'desc' },
    select: {
      assignedAt: true,
      role: { select: roleSummarySelect },
    },
  },
  adminProfile: { select: adminProfileSummarySelect },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const adminUserDetailSelect = {
  ...adminUserListSelect,
  emailVerified: true,
  profile: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
  _count: { select: { addresses: true } },
} satisfies Prisma.UserSelect;

export type AdminUserListRecord = Prisma.UserGetPayload<{
  select: typeof adminUserListSelect;
}>;

export type AdminUserDetailRecord = Prisma.UserGetPayload<{
  select: typeof adminUserDetailSelect;
}>;

function toWhere(criteria: AdminUserListCriteria): Prisma.UserWhereInput {
  const filters: Prisma.UserWhereInput[] = [];

  if (criteria.status !== undefined) {
    filters.push({ status: criteria.status });
  }

  if (criteria.query !== undefined) {
    filters.push({
      OR: [
        { email: { contains: criteria.query, mode: 'insensitive' } },
        { mobile: { contains: criteria.query } },
        { name: { contains: criteria.query, mode: 'insensitive' } },
        {
          profile: {
            is: {
              OR: [
                { firstName: { contains: criteria.query, mode: 'insensitive' } },
                { lastName: { contains: criteria.query, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    });
  }

  return filters.length === 0 ? {} : { AND: filters };
}

export const adminUserRepository = {
  async findPage(
    criteria: AdminUserListCriteria,
    client: AdminDatabaseClient = prisma,
  ): Promise<Readonly<{ items: readonly AdminUserListRecord[]; total: number }>> {
    const where = toWhere(criteria);
    const skip = (criteria.page - 1) * criteria.pageSize;
    const [items, total] = await Promise.all([
      client.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: criteria.pageSize,
        select: adminUserListSelect,
      }),
      client.user.count({ where }),
    ]);

    return { items, total };
  },

  findDetailById(
    userId: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<AdminUserDetailRecord | null> {
    return client.user.findUnique({
      where: { id: userId },
      select: adminUserDetailSelect,
    });
  },

  updateStatus(
    userId: string,
    status: UserStatus,
    client: AdminDatabaseClient = prisma,
  ): Promise<AdminUserDetailRecord> {
    return client.user.update({
      where: { id: userId },
      data: { status },
      select: adminUserDetailSelect,
    });
  },

  assignRole(
    userId: string,
    roleId: string,
    client: AdminDatabaseClient = prisma,
  ) {
    return client.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId },
      update: {},
      select: {
        assignedAt: true,
        role: { select: roleSummarySelect },
      },
    });
  },

  countByStatus(client: AdminDatabaseClient = prisma) {
    return Promise.all([
      client.user.count({ where: { status: 'ACTIVE' } }),
      client.user.count({ where: { status: 'INACTIVE' } }),
      client.user.count({ where: { status: 'SUSPENDED' } }),
    ]).then(([active, inactive, suspended]) => ({ active, inactive, suspended }));
  },
};
