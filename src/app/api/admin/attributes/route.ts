import {
  createProductAttributeInput,
  productListQuery,
  type CreateProductAttributeInput,
  type ProductListQuery,
} from '@/modules/pim/validators';
import { jsonBody, queryParams, withAdminRoute } from '@/server/admin/route';
import { createAdminProductAttribute, listAdminProductAttributes } from '@/server/services/pim-service';

export const GET = withAdminRoute<ProductListQuery>({
  permission: 'attributes.read',
  parse: queryParams(productListQuery),
  handler: ({ input }) => listAdminProductAttributes(input),
});

export const POST = withAdminRoute<CreateProductAttributeInput>({
  permission: 'attributes.create',
  mutation: true,
  parse: jsonBody(createProductAttributeInput),
  handler: ({ input, audit }) => createAdminProductAttribute(input, audit),
  status: 201,
});
