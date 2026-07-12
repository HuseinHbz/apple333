import { z } from 'zod';

import { updateSpecificationGroupInput, type UpdateSpecificationGroupInput } from '@/modules/pim/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { deleteAdminSpecificationGroup, updateAdminSpecificationGroup } from '@/server/services/pim-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute<{ id: string; input: UpdateSpecificationGroupInput }>({
    permission: 'attributes.update',
    mutation: true,
    parse: async (incoming) => ({ id: z.string().cuid().parse(id), input: await jsonBody(updateSpecificationGroupInput)(incoming) }),
    handler: ({ input, audit }) => updateAdminSpecificationGroup(input.id, input.input, audit),
  })(request);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute<{ id: string }>({
    permission: 'attributes.delete',
    mutation: true,
    parse: async () => ({ id: z.string().cuid().parse(id) }),
    handler: async ({ input, audit }) => {
      await deleteAdminSpecificationGroup(input.id, audit);
      return { deleted: true };
    },
  })(request);
}
