import { z } from 'zod';

import {
  productWorkflowInput,
  updateProductInput,
  type ProductWorkflowInput,
  type UpdateProductInput,
} from '@/modules/pim/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { deleteAdminProduct, getAdminProduct, updateAdminProduct } from '@/server/services/pim-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute({
    permission: 'products.read',
    parse: async () => z.string().cuid().parse(id),
    handler: ({ input }) => getAdminProduct(input),
  })(request);
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute<{ id: string; input: UpdateProductInput }>({
    permission: 'products.update',
    mutation: true,
    parse: async (incoming) => ({ id: z.string().cuid().parse(id), input: await jsonBody(updateProductInput)(incoming) }),
    handler: ({ input, audit }) => updateAdminProduct(input.id, input.input, audit),
  })(request);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute<{ id: string; input: ProductWorkflowInput }>({
    permission: 'products.delete',
    mutation: true,
    parse: async (incoming) => ({ id: z.string().cuid().parse(id), input: await jsonBody(productWorkflowInput)(incoming) }),
    handler: async ({ input, audit }) => {
      await deleteAdminProduct(input.id, input.input, audit);
      return { deleted: true };
    },
  })(request);
}
