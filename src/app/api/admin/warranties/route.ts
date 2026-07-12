import { createWarrantyInput, productListQuery, type CreateWarrantyInput, type ProductListQuery } from '@/modules/pim/validators';
import { jsonBody, queryParams, withAdminRoute } from '@/server/admin/route';
import { createAdminWarranty, listAdminWarranties } from '@/server/services/pim-service';

export const GET = withAdminRoute<ProductListQuery>({
  permission: 'warranties.read',
  parse: queryParams(productListQuery),
  handler: ({ input }) => listAdminWarranties(input),
});

export const POST = withAdminRoute<CreateWarrantyInput>({
  permission: 'warranties.create',
  mutation: true,
  parse: jsonBody(createWarrantyInput),
  handler: ({ input, audit }) => createAdminWarranty(input, audit),
  status: 201,
});
