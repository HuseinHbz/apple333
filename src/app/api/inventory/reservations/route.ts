import { createInventoryReservationInput, type CreateInventoryReservationInput } from '@/modules/inventory/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { reserveInventory } from '@/server/services/inventory-service';
import { revalidateStorefrontInventory } from '@/server/services/storefront-inventory-cache';

export const POST = withAdminRoute<CreateInventoryReservationInput>({
  permission: 'inventory.reserve',
  mutation: true,
  status: 201,
  parse: jsonBody(createInventoryReservationInput),
  handler: async ({ actor, input, audit }) => {
    const result = await reserveInventory(actor, input, audit);
    revalidateStorefrontInventory();
    return result;
  },
});
