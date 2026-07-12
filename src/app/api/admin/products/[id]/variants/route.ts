import { z } from 'zod';

import { productVariantInput, type ProductVariantInput } from '@/modules/pim/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { createAdminProductVariant } from '@/server/services/pim-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute<{ productId: string; input: ProductVariantInput }>({
    permission: 'products.update',
    mutation: true,
    parse: async (incoming) => ({ productId: z.string().cuid().parse(id), input: await jsonBody(productVariantInput)(incoming) }),
    handler: ({ input, audit }) => createAdminProductVariant(input.productId, input.input, audit),
    status: 201,
  })(request);
}
