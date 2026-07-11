import { ConflictError } from '@/server/errors/app-error';
import { auditInput, requireAuditContext } from '@/server/admin/audit';
import { toSettingDto, toSettingVersionDto } from '@/server/admin/mappers';
import type { AdminAuditContext, AdminSettingDto, AdminSettingVersionDto } from '@/server/admin/types';
import { NotFoundError } from '@/server/errors/app-error';
import type { UpsertSettingInput } from '@/modules/settings/validators';
import { prisma } from '@/server/db/prisma';
import { auditLogRepository } from '@/server/repositories/audit-log-repository';
import { settingRepository } from '@/server/repositories/setting-repository';

export async function listAdminSettings(): Promise<readonly AdminSettingDto[]> {
  return (await settingRepository.list()).map(toSettingDto);
}

export async function listAdminSettingVersions(key: string): Promise<readonly AdminSettingVersionDto[]> {
  const setting = await settingRepository.findByKey(key);
  if (setting === null) {
    throw new NotFoundError();
  }
  return (await settingRepository.listVersions(setting.id)).map((version) => toSettingVersionDto(version, setting.isSensitive));
}

export async function upsertAdminSetting(
  input: UpsertSettingInput,
  context: AdminAuditContext,
): Promise<AdminSettingDto> {
  const auditContext = requireAuditContext(context);

  return prisma.$transaction(async (transaction) => {
    const current = await settingRepository.findByKey(input.key, transaction);

    if (current === null) {
      if (input.expectedVersion !== undefined && input.expectedVersion !== 0) {
        throw new ConflictError();
      }

      const created = await settingRepository.create(
        {
          key: input.key,
          category: input.category,
          value: input.value,
          isSensitive: input.isSensitive,
          updatedById: auditContext.actorId,
        },
        transaction,
      );
      await settingRepository.createVersion(
        created.id,
        created.version,
        input.value,
        auditContext.actorId,
        transaction,
      );
      await auditLogRepository.create(
        auditInput(auditContext, {
          action: 'admin.setting.created',
          entityType: 'SystemSetting',
          entityId: created.id,
          metadata: {
            key: created.key,
            version: created.version,
            isSensitive: created.isSensitive,
          },
        }),
        transaction,
      );

      return toSettingDto(created);
    }

    if (input.expectedVersion !== current.version) {
      throw new ConflictError();
    }

    const updated = await settingRepository.updateIfVersionMatches(
      current.id,
      current.version,
      {
        key: input.key,
        category: input.category,
        value: input.value,
        isSensitive: input.isSensitive,
        updatedById: auditContext.actorId,
      },
      transaction,
    );
    if (updated === null) {
      throw new ConflictError();
    }

    await settingRepository.createVersion(
      updated.id,
      updated.version,
      input.value,
      auditContext.actorId,
      transaction,
    );
    await auditLogRepository.create(
      auditInput(auditContext, {
        action: 'admin.setting.updated',
        entityType: 'SystemSetting',
        entityId: updated.id,
        metadata: {
          key: updated.key,
          previousVersion: current.version,
          version: updated.version,
          isSensitive: updated.isSensitive,
        },
      }),
      transaction,
    );

    return toSettingDto(updated);
  });
}
