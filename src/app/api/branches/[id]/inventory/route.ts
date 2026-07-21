import { z } from 'zod';

import { inventoryPageQuery } from '@/modules/inventory/validators';
import { queryParams, withAdminRoute } from '@/server/admin/route';
import { listInventory } from '@/server/services/inventory-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute({
    permission: 'inventory.read',
    parse: async (incoming) => ({ id: z.string().cuid().parse(id), query: await queryParams(inventoryPageQuery)(incoming) }),
    handler: ({ actor, input }) => listInventory(actor, { ...input.query, branchId: input.id }),
  })(request);
}
