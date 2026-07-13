import { z } from 'zod';

import { withAdminRoute } from '@/server/admin/route';
import { deleteAdminProductMedia } from '@/server/services/pim-service';

type RouteContext = { params: Promise<{ id: string; mediaId: string }> };

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { id, mediaId } = await context.params;
  return withAdminRoute<{ productId: string; mediaId: string }>({
    permission: 'products.update',
    mutation: true,
    parse: async () => ({ productId: z.string().cuid().parse(id), mediaId: z.string().cuid().parse(mediaId) }),
    handler: async ({ input, audit }) => {
      await deleteAdminProductMedia(input.productId, input.mediaId, audit);
      return { deleted: true };
    },
  })(request);
}
