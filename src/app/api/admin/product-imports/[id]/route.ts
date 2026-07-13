import { z } from 'zod';

import { withAdminRoute } from '@/server/admin/route';
import { getAdminProductImport } from '@/server/services/pim-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute({
    permission: 'product-imports.read',
    parse: async () => z.string().cuid().parse(id),
    handler: ({ input }) => getAdminProductImport(input),
  })(request);
}
