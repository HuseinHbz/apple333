import { transferInventoryInput, type TransferInventoryInput } from '@/modules/inventory/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { transferInventory } from '@/server/services/inventory-service';
import { revalidateStorefrontInventory } from '@/server/services/storefront-inventory-cache';

export const POST = withAdminRoute<TransferInventoryInput>({
  permission: 'inventory.transfer',
  mutation: true,
  parse: jsonBody(transferInventoryInput),
  handler: async ({ actor, input, audit }) => {
    const result = await transferInventory(actor, input, audit);
    revalidateStorefrontInventory();
    return result;
  },
});
