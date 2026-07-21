import { z } from 'zod';

import { releaseInventoryReservationInput } from '@/modules/inventory/validators';
import { withAdminRoute } from '@/server/admin/route';
import { releaseInventoryReservation } from '@/server/services/inventory-service';
import { revalidateStorefrontInventory } from '@/server/services/storefront-inventory-cache';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute({
    permission: 'inventory.release',
    mutation: true,
    parse: async (incoming) => releaseInventoryReservationInput.parse({
      ...((await incoming.json()) as Record<string, unknown>),
      reservationId: z.string().cuid().parse(id),
    }),
    handler: async ({ actor, input, audit }) => {
      const result = await releaseInventoryReservation(actor, input, audit);
      revalidateStorefrontInventory();
      return result;
    },
  })(request);
}
