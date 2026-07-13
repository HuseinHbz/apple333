import { createBrandInput, productListQuery, type CreateBrandInput, type ProductListQuery } from '@/modules/pim/validators';
import { jsonBody, queryParams, withAdminRoute } from '@/server/admin/route';
import { createAdminBrand, listAdminBrands } from '@/server/services/pim-service';

export const GET = withAdminRoute<ProductListQuery>({
  permission: 'brands.read',
  parse: queryParams(productListQuery),
  handler: ({ input }) => listAdminBrands(input),
});

export const POST = withAdminRoute<CreateBrandInput>({
  permission: 'brands.create',
  mutation: true,
  parse: jsonBody(createBrandInput),
  handler: ({ input, audit }) => createAdminBrand(input, audit),
  status: 201,
});
