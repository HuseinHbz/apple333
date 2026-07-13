import { z } from 'zod';

import { updateBrandInput, type UpdateBrandInput } from '@/modules/pim/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { deleteAdminBrand, updateAdminBrand } from '@/server/services/pim-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute<{ id: string; input: UpdateBrandInput }>({
    permission: 'brands.update',
    mutation: true,
    parse: async (incoming) => ({ id: z.string().cuid().parse(id), input: await jsonBody(updateBrandInput)(incoming) }),
    handler: ({ input, audit }) => updateAdminBrand(input.id, input.input, audit),
  })(request);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute<{ id: string }>({
    permission: 'brands.delete',
    mutation: true,
    parse: async () => ({ id: z.string().cuid().parse(id) }),
    handler: async ({ input, audit }) => {
      await deleteAdminBrand(input.id, audit);
      return { deleted: true };
    },
  })(request);
}
