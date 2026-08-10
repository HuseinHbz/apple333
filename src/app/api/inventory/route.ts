import { inventoryPageQuery, type InventoryPageQuery } from '@/modules/inventory/validators';
import { queryParams, withAdminRoute } from '@/server/admin/route';
import { inventoryDashboard, listInventory } from '@/server/services/inventory-service';

export const GET = withAdminRoute<InventoryPageQuery>({
  permission: 'inventory.read',
  parse: queryParams(inventoryPageQuery),
  handler: async ({ actor, input }) => ({
    dashboard: await inventoryDashboard(actor, input.branchId),
    inventory: await listInventory(actor, input),
  }),
});
