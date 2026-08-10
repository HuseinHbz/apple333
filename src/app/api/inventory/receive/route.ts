import { receiveInventoryInput, type ReceiveInventoryInput } from '@/modules/inventory/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { receiveInventory } from '@/server/services/inventory-service';
import { revalidateStorefrontInventory } from '@/server/services/storefront-inventory-cache';

export const POST = withAdminRoute<ReceiveInventoryInput>({
  permission: 'inventory.receive',
  mutation: true,
  status: 201,
  parse: jsonBody(receiveInventoryInput),
  handler: async ({ actor, input, audit }) => {
    const result = await receiveInventory(actor, input, audit);
    revalidateStorefrontInventory();
    return result;
  },
});
