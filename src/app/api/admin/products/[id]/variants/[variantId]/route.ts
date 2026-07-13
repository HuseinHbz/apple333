import { z } from 'zod';

import { updateProductVariantInput, type UpdateProductVariantInput } from '@/modules/pim/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { deleteAdminProductVariant, updateAdminProductVariant } from '@/server/services/pim-service';

type RouteContext = { params: Promise<{ id: string; variantId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { id, variantId } = await context.params;
  return withAdminRoute<{ productId: string; variantId: string; input: UpdateProductVariantInput }>({
    permission: 'products.update',
    mutation: true,
    parse: async (incoming) => ({
      productId: z.string().cuid().parse(id),
      variantId: z.string().cuid().parse(variantId),
      input: await jsonBody(updateProductVariantInput)(incoming),
    }),
    handler: ({ input, audit }) => updateAdminProductVariant(input.productId, input.variantId, input.input, audit),
  })(request);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { id, variantId } = await context.params;
  return withAdminRoute<{ productId: string; variantId: string }>({
    permission: 'products.delete',
    mutation: true,
    parse: async () => ({ productId: z.string().cuid().parse(id), variantId: z.string().cuid().parse(variantId) }),
    handler: async ({ input, audit }) => {
      await deleteAdminProductVariant(input.productId, input.variantId, audit);
      return { deleted: true };
    },
  })(request);
}
