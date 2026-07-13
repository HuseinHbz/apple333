import { z } from 'zod';

import { updateCategoryInput, type UpdateCategoryInput } from '@/modules/pim/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { deleteAdminCategory, updateAdminCategory } from '@/server/services/pim-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute<{ id: string; input: UpdateCategoryInput }>({
    permission: 'categories.update',
    mutation: true,
    parse: async (incoming) => ({ id: z.string().cuid().parse(id), input: await jsonBody(updateCategoryInput)(incoming) }),
    handler: ({ input, audit }) => updateAdminCategory(input.id, input.input, audit),
  })(request);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute<{ id: string }>({
    permission: 'categories.delete',
    mutation: true,
    parse: async () => ({ id: z.string().cuid().parse(id) }),
    handler: async ({ input, audit }) => {
      await deleteAdminCategory(input.id, audit);
      return { deleted: true };
    },
  })(request);
}
