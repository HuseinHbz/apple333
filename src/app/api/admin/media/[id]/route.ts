import { z } from 'zod';

import { withAdminRoute } from '@/server/admin/route';
import { deleteAdminMedia } from '@/server/services/media-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute({
    permission: 'media.delete',
    mutation: true,
    parse: async () => z.string().cuid().parse(id),
    handler: ({ input, audit }) => deleteAdminMedia(input, audit)
  })(request);
}
