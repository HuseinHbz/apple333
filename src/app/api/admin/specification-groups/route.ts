import {
  createSpecificationGroupInput,
  productListQuery,
  type CreateSpecificationGroupInput,
  type ProductListQuery,
} from '@/modules/pim/validators';
import { jsonBody, queryParams, withAdminRoute } from '@/server/admin/route';
import { createAdminSpecificationGroup, listAdminSpecificationGroups } from '@/server/services/pim-service';

export const GET = withAdminRoute<ProductListQuery>({
  permission: 'attributes.read',
  parse: queryParams(productListQuery),
  handler: ({ input }) => listAdminSpecificationGroups(input),
});

export const POST = withAdminRoute<CreateSpecificationGroupInput>({
  permission: 'attributes.create',
  mutation: true,
  parse: jsonBody(createSpecificationGroupInput),
  handler: ({ input, audit }) => createAdminSpecificationGroup(input, audit),
  status: 201,
});
