import { z } from 'zod';

import { NotFoundError } from '@/server/errors/app-error';
import { catalogRepository } from '@/server/repositories/catalog-repository';
import { objectStorage } from '@/server/storage/object-storage';
import { runStoreRoute } from '@/server/storefront/route';

const mediaRouteParams = z.object({ productId: z.string().cuid(), mediaId: z.string().cuid() });
type RouteContext = { params: Promise<{ productId: string; mediaId: string }> };

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  return runStoreRoute(request, {
    rateLimitKey: 'store.media',
    parse: async () => mediaRouteParams.parse(await params),
    handler: async (input) => {
      const record = await catalogRepository.findPublicMedia(input.productId, input.mediaId);
      if (!record) throw new NotFoundError();
      const body = await objectStorage.get(record.media.storageKey);
      const safeName = record.media.originalName.replace(/[\\\r\n"]/g, '_');
      return new Response(body, {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=86400, immutable',
          'Content-Type': record.media.contentType,
          'Content-Disposition': `inline; filename="${safeName}"`,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    },
  });
}
