import { Prisma } from '@prisma/client';
import type { SettingCategory } from '@prisma/client';

import type { JsonInput } from '@/modules/settings/validators';
import type { AdminDatabaseClient } from '@/server/admin/database';
import { prisma } from '@/server/db/prisma';

export const settingSelect = {
  id: true,
  key: true,
  category: true,
  value: true,
  isSensitive: true,
  version: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SystemSettingSelect;

export type SettingRecord = Prisma.SystemSettingGetPayload<{
  select: typeof settingSelect;
}>;

export const settingVersionSelect = {
  id: true,
  version: true,
  value: true,
  changedById: true,
  createdAt: true,
} satisfies Prisma.SystemSettingVersionSelect;

export type SettingVersionRecord = Prisma.SystemSettingVersionGetPayload<{
  select: typeof settingVersionSelect;
}>;

type SettingWriteData = Readonly<{
  key: string;
  category: SettingCategory;
  value: JsonInput;
  isSensitive: boolean;
  updatedById: string;
}>;

function toPrismaJson(
  value: JsonInput,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

export const settingRepository = {
  list(client: AdminDatabaseClient = prisma): Promise<SettingRecord[]> {
    return client.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
      select: settingSelect,
    });
  },

  findByKey(
    key: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<SettingRecord | null> {
    return client.systemSetting.findUnique({
      where: { key },
      select: settingSelect,
    });
  },

  create(
    input: SettingWriteData,
    client: AdminDatabaseClient = prisma,
  ): Promise<SettingRecord> {
    return client.systemSetting.create({
      data: {
        key: input.key,
        category: input.category,
        value: toPrismaJson(input.value),
        isSensitive: input.isSensitive,
        updatedBy: { connect: { id: input.updatedById } },
      },
      select: settingSelect,
    });
  },

  async updateIfVersionMatches(
    settingId: string,
    expectedVersion: number,
    input: SettingWriteData,
    client: AdminDatabaseClient = prisma,
  ): Promise<SettingRecord | null> {
    const result = await client.systemSetting.updateMany({
      where: { id: settingId, version: expectedVersion },
      data: {
        category: input.category,
        value: toPrismaJson(input.value),
        isSensitive: input.isSensitive,
        version: { increment: 1 },
        updatedById: input.updatedById,
      },
    });

    if (result.count !== 1) {
      return null;
    }

    return client.systemSetting.findUnique({
      where: { id: settingId },
      select: settingSelect,
    });
  },

  createVersion(
    settingId: string,
    version: number,
    value: JsonInput,
    changedById: string,
    client: AdminDatabaseClient = prisma,
  ) {
    return client.systemSettingVersion.create({
      data: {
        setting: { connect: { id: settingId } },
        version,
        value: toPrismaJson(value),
        changedBy: { connect: { id: changedById } },
      },
      select: { id: true, settingId: true, version: true, createdAt: true },
    });
  },

  listVersions(
    settingId: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<SettingVersionRecord[]> {
    return client.systemSettingVersion.findMany({
      where: { settingId },
      orderBy: { version: 'desc' },
      select: settingVersionSelect,
    });
  },
};
