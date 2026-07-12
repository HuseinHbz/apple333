import { productImportPreviewInput, type ProductImportPreviewInput } from '@/modules/pim/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { previewAdminProductImport } from '@/server/services/pim-service';

export const POST = withAdminRoute<ProductImportPreviewInput>({
  permission: 'product-imports.create',
  mutation: true,
  parse: jsonBody(productImportPreviewInput),
  handler: ({ input, audit }) => previewAdminProductImport(input, audit),
  status: 201,
});
