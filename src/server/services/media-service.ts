import { ConflictError, NotFoundError } from '@/server/errors/app-error';
import { auditInput, requireAuditContext } from '@/server/admin/audit';
import { toMediaDto } from '@/server/admin/mappers';
import { toPage } from '@/server/admin/pagination';
import type {
  AdminAuditContext,
  AdminMediaDto,
  Page,
} from '@/server/admin/types';
import type {
  CreateMediaInput,
  MediaListQuery,
} from '@/modules/media/validators';
import { prisma } from '@/server/db/prisma';
import { auditLogRepository } from '@/server/repositories/audit-log-repository';
import { mediaRepository } from '@/server/repositories/media-repository';

export async function listAdminMedia(
  query: MediaListQuery,
): Promise<Page<AdminMediaDto>> {
  const result = await mediaRepository.findPage({
    page: query.page,
    pageSize: query.pageSize,
    includeDeleted: query.includeDeleted,
    ...(query.kind === undefined ? {} : { kind: query.kind }),
  });

  return toPage(result.items.map(toMediaDto), query, result.total);
}

export async function createAdminMedia(
  input: CreateMediaInput,
  context: AdminAuditContext,
): Promise<AdminMediaDto> {
  const auditContext = requireAuditContext(context);

  return prisma.$transaction(async (transaction) => {
    const media = await mediaRepository.create(
      input,
      auditContext.actorId,
      transaction,
    );
    await auditLogRepository.create(
      auditInput(auditContext, {
        action: 'admin.media.created',
        entityType: 'MediaFile',
        entityId: media.id,
        metadata: {
          kind: media.kind,
          contentType: media.contentType,
          bytes: media.bytes,
        },
      }),
      transaction,
    );

    return toMediaDto(media);
  });
}

export async function deleteAdminMedia(
  mediaId: string,
  context: AdminAuditContext,
): Promise<AdminMediaDto> {
  const auditContext = requireAuditContext(context);

  return prisma.$transaction(async (transaction) => {
    const existing = await mediaRepository.findById(mediaId, transaction);
    if (existing === null) {
      throw new NotFoundError();
    }
    if (existing.deletedAt !== null) {
      throw new ConflictError();
    }

    const media = await mediaRepository.softDelete(mediaId, transaction);
    await auditLogRepository.create(
      auditInput(auditContext, {
        action: 'admin.media.deleted',
        entityType: 'MediaFile',
        entityId: media.id,
        metadata: { kind: media.kind },
      }),
      transaction,
    );

    return toMediaDto(media);
  });
}
