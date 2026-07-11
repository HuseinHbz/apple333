import { z } from 'zod';

import { auditInput } from '@/server/admin/audit';
import { withAdminRoute } from '@/server/admin/route';
import { prisma } from '@/server/db/prisma';
import { NotFoundError } from '@/server/errors/app-error';
import { auditLogRepository } from '@/server/repositories/audit-log-repository';
import { objectStorage } from '@/server/storage/object-storage';

const mediaKeyQuery = z.object({
  key: z.string().regex(/^media\/[0-9]{4}\/[A-Za-z0-9-]+\.[A-Za-z0-9]+$/)
});

export const GET = withAdminRoute<{ key: string }, Response>({
  permission: 'media.read',
  parse: async (request) => mediaKeyQuery.parse(Object.fromEntries(new URL(request.url).searchParams.entries())),
  handler: async ({ input, audit }) => {
    const media = await prisma.mediaFile.findUnique({
      where: { storageKey: input.key },
      select: { id: true, originalName: true, contentType: true, deletedAt: true }
    });
    if (!media || media.deletedAt) {
      throw new NotFoundError();
    }

    const body = await objectStorage.get(input.key);
    await auditLogRepository.create(auditInput(audit, {
      action: 'admin.media.read',
      entityType: 'MediaFile',
      entityId: media.id,
      metadata: { contentType: media.contentType }
    }));

    const safeName = media.originalName.replace(/[\\\r\n"]/g, '_');
    return new Response(body, {
      headers: {
        'Content-Type': media.contentType,
        'Content-Disposition': `inline; filename="${safeName}"`,
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }
});
