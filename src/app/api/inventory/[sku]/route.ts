import { z } from 'zod';

import { inventorySkuRouteInput } from '@/modules/inventory/validators';
import { withAdminRoute } from '@/server/admin/route';
import { getInventoryBySku } from '@/server/services/inventory-service';

type RouteContext = { params: Promise<{ sku: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { sku } = await context.params;
  return withAdminRoute({
    permission: 'inventory.read',
    parse: async () => inventorySkuRouteInput.parse({ sku: z.string().parse(sku) }),
    handler: ({ actor, input }) => getInventoryBySku(actor, input.sku),
  })(request);
}
