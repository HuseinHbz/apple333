import { z } from 'zod';

import { updateWarrantyInput, type UpdateWarrantyInput } from '@/modules/pim/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { deleteAdminWarranty, updateAdminWarranty } from '@/server/services/pim-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute<{ id: string; input: UpdateWarrantyInput }>({
    permission: 'warranties.update',
    mutation: true,
    parse: async (incoming) => ({ id: z.string().cuid().parse(id), input: await jsonBody(updateWarrantyInput)(incoming) }),
    handler: ({ input, audit }) => updateAdminWarranty(input.id, input.input, audit),
  })(request);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute<{ id: string }>({
    permission: 'warranties.delete',
    mutation: true,
    parse: async () => ({ id: z.string().cuid().parse(id) }),
    handler: async ({ input, audit }) => {
      await deleteAdminWarranty(input.id, audit);
      return { deleted: true };
    },
  })(request);
}
