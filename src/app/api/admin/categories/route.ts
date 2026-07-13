import { createCategoryInput, productListQuery, type CreateCategoryInput, type ProductListQuery } from '@/modules/pim/validators';
import { jsonBody, queryParams, withAdminRoute } from '@/server/admin/route';
import { createAdminCategory, listAdminCategories } from '@/server/services/pim-service';

export const GET = withAdminRoute<ProductListQuery>({
  permission: 'categories.read',
  parse: queryParams(productListQuery),
  handler: ({ input }) => listAdminCategories(input),
});

export const POST = withAdminRoute<CreateCategoryInput>({
  permission: 'categories.create',
  mutation: true,
  parse: jsonBody(createCategoryInput),
  handler: ({ input, audit }) => createAdminCategory(input, audit),
  status: 201,
});
