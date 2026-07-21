import { z } from 'zod';

import { updateBranchInput } from '@/modules/inventory/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { updateBranch } from '@/server/services/inventory-service';
import { revalidateStorefrontInventory } from '@/server/services/storefront-inventory-cache';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute({
    permission: 'branches.update',
    mutation: true,
    parse: async (incoming) => ({ id: z.string().cuid().parse(id), input: await jsonBody(updateBranchInput)(incoming) }),
    handler: async ({ actor, input, audit }) => {
      const result = await updateBranch(actor, input.id, input.input, audit);
      revalidateStorefrontInventory();
      return result;
    },
  })(request);
}
