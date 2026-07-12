import { z } from 'zod';

import { productImportApplyInput } from '@/modules/pim/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { applyAdminProductImport } from '@/server/services/pim-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute<{ id: string }>({
    permission: 'product-imports.apply',
    mutation: true,
    parse: async (incoming) => {
      await jsonBody(productImportApplyInput)(incoming);
      return { id: z.string().cuid().parse(id) };
    },
    handler: ({ input, audit }) => applyAdminProductImport(input.id, audit),
  })(request);
}
