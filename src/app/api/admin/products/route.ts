import {
  createProductInput,
  productListQuery,
  type CreateProductInput,
  type ProductListQuery,
} from '@/modules/pim/validators';
import { jsonBody, queryParams, withAdminRoute } from '@/server/admin/route';
import { createAdminProduct, listAdminProducts } from '@/server/services/pim-service';

export const GET = withAdminRoute<ProductListQuery>({
  permission: 'products.read',
  parse: queryParams(productListQuery),
  handler: ({ input }) => listAdminProducts(input),
});

export const POST = withAdminRoute<CreateProductInput>({
  permission: 'products.create',
  mutation: true,
  parse: jsonBody(createProductInput),
  handler: ({ input, audit }) => createAdminProduct(input, audit),
  status: 201,
});
