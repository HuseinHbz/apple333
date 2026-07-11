import { Prisma } from '@prisma/client';
import type { MediaKind } from '@prisma/client';

import type { CreateMediaInput } from '@/modules/media/validators';
import type { AdminDatabaseClient } from '@/server/admin/database';
import { prisma } from '@/server/db/prisma';

export const mediaSelect = {
  id: true,
  originalName: true,
  contentType: true,
  extension: true,
  bytes: true,
  kind: true,
  url: true,
  checksum: true,
  metadata: true,
  uploadedById: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MediaFileSelect;

export type MediaRecord = Prisma.MediaFileGetPayload<{
  select: typeof mediaSelect;
}>;

type MediaListCriteria = Readonly<{
  page: number;
  pageSize: number;
  kind?: MediaKind;
  includeDeleted: boolean;
}>;

function toMetadata(
  metadata: CreateMediaInput['metadata'],
): Prisma.InputJsonValue | undefined {
  return metadata === undefined ? undefined : (metadata as Prisma.InputJsonValue);
}

export const mediaRepository = {
  async findPage(
    criteria: MediaListCriteria,
    client: AdminDatabaseClient = prisma,
  ): Promise<Readonly<{ items: readonly MediaRecord[]; total: number }>> {
    const where: Prisma.MediaFileWhereInput = {
      ...(criteria.kind === undefined ? {} : { kind: criteria.kind }),
      ...(criteria.includeDeleted ? {} : { deletedAt: null }),
    };

    const [items, total] = await Promise.all([
      client.mediaFile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (criteria.page - 1) * criteria.pageSize,
        take: criteria.pageSize,
        select: mediaSelect,
      }),
      client.mediaFile.count({ where }),
    ]);

    return { items, total };
  },

  findById(
    mediaId: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<MediaRecord | null> {
    return client.mediaFile.findUnique({
      where: { id: mediaId },
      select: mediaSelect,
    });
  },

  create(
    input: CreateMediaInput,
    uploadedById: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<MediaRecord> {
    const metadata = toMetadata(input.metadata);

    return client.mediaFile.create({
      data: {
        storageKey: input.storageKey,
        originalName: input.originalName,
        contentType: input.contentType,
        extension: input.extension,
        bytes: input.bytes,
        kind: input.kind,
        ...(input.url === undefined ? {} : { url: input.url }),
        ...(input.checksum === undefined ? {} : { checksum: input.checksum }),
        ...(metadata === undefined ? {} : { metadata }),
        uploadedBy: { connect: { id: uploadedById } },
      },
      select: mediaSelect,
    });
  },

  softDelete(
    mediaId: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<MediaRecord> {
    return client.mediaFile.update({
      where: { id: mediaId },
      data: { deletedAt: new Date() },
      select: mediaSelect,
    });
  },

  countActive(client: AdminDatabaseClient = prisma) {
    return client.mediaFile.count({ where: { deletedAt: null } });
  },
};
