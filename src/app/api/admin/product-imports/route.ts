import {
  productImportListQuery,
  productImportPreviewInput,
  type ProductImportListQuery,
  type ProductImportPreviewInput,
} from '@/modules/pim/validators';
import { jsonBody, queryParams, withAdminRoute } from '@/server/admin/route';
import { listAdminProductImports, previewAdminProductImport } from '@/server/services/pim-service';

export const GET = withAdminRoute<ProductImportListQuery>({
  permission: 'product-imports.read',
  parse: queryParams(productImportListQuery),
  handler: ({ input }) => listAdminProductImports(input),
});

export const POST = withAdminRoute<ProductImportPreviewInput>({
  permission: 'product-imports.create',
  mutation: true,
  parse: jsonBody(productImportPreviewInput),
  handler: ({ input, audit }) => previewAdminProductImport(input, audit),
  status: 201,
});
