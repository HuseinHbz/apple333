import { createWarehouseInput, inventoryResourcePageQuery, type CreateWarehouseInput, type InventoryResourcePageQuery } from '@/modules/inventory/validators';
import { jsonBody, queryParams, withAdminRoute } from '@/server/admin/route';
import { createWarehouse, listWarehouses } from '@/server/services/inventory-service';

export const GET = withAdminRoute<InventoryResourcePageQuery>({
  permission: 'warehouses.read',
  parse: queryParams(inventoryResourcePageQuery),
  handler: ({ actor, input }) => listWarehouses(actor, input.page, input.pageSize, input.branchId),
});

export const POST = withAdminRoute<CreateWarehouseInput>({
  permission: 'warehouses.create',
  mutation: true,
  status: 201,
  parse: jsonBody(createWarehouseInput),
  handler: ({ actor, input, audit }) => createWarehouse(actor, input, audit),
});
