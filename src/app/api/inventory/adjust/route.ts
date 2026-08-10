import { adjustInventoryInput, type AdjustInventoryInput } from '@/modules/inventory/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { adjustInventory } from '@/server/services/inventory-service';
import { revalidateStorefrontInventory } from '@/server/services/storefront-inventory-cache';

export const POST = withAdminRoute<AdjustInventoryInput>({
  permission: 'inventory.adjust',
  mutation: true,
  parse: jsonBody(adjustInventoryInput),
  handler: async ({ actor, input, audit }) => {
    const result = await adjustInventory(actor, input, audit);
    revalidateStorefrontInventory();
    return result;
  },
});
