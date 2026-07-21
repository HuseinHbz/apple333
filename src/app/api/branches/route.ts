import { createBranchInput, inventoryResourcePageQuery, type CreateBranchInput, type InventoryResourcePageQuery } from '@/modules/inventory/validators';
import { jsonBody, queryParams, withAdminRoute } from '@/server/admin/route';
import { createBranch, listBranches } from '@/server/services/inventory-service';

export const GET = withAdminRoute<InventoryResourcePageQuery>({
  permission: 'branches.read',
  parse: queryParams(inventoryResourcePageQuery),
  handler: ({ actor, input }) => listBranches(actor, input.page, input.pageSize),
});

export const POST = withAdminRoute<CreateBranchInput>({
  permission: 'branches.create',
  mutation: true,
  status: 201,
  parse: jsonBody(createBranchInput),
  handler: ({ input, audit }) => createBranch(input, audit),
});
