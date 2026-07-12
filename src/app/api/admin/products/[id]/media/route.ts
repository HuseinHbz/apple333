import { z } from 'zod';

import { productMediaInput, type ProductMediaInput } from '@/modules/pim/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { addAdminProductMedia } from '@/server/services/pim-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute<{ productId: string; input: ProductMediaInput }>({
    permission: 'products.update',
    mutation: true,
    parse: async (incoming) => ({ productId: z.string().cuid().parse(id), input: await jsonBody(productMediaInput)(incoming) }),
    handler: ({ input, audit }) => addAdminProductMedia(input.productId, input.input, audit),
  })(request);
}
