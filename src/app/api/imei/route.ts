import { inventoryDeviceListQuery, type InventoryDeviceListQuery } from '@/modules/inventory/validators';
import { queryParams, withAdminRoute } from '@/server/admin/route';
import { listDeviceUnits } from '@/server/services/inventory-service';

export const GET = withAdminRoute<InventoryDeviceListQuery>({
  permission: 'devices.read',
  parse: queryParams(inventoryDeviceListQuery),
  handler: ({ actor, input }) => listDeviceUnits(actor, input),
});
