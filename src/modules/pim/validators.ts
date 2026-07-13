import { z } from 'zod';

const cuid = z.string().cuid();
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(160);
const code = z.string().trim().toUpperCase().regex(/^[A-Z0-9]+(?:[-_][A-Z0-9]+)*$/).min(2).max(96);
const nullableText = z.string().trim().min(1).max(20_000).nullable();
const optionalText = z.string().trim().min(1).max(20_000).optional();
const money = z.coerce.bigint().nonnegative();

/**
 * Keep import staging bounded independently from the transport layer. CSV
 * staging already uses the same limits; the JSON preview endpoint must not be
 * a less restrictive alternate path.
 */
export const PIM_IMPORT_MAX_ROW_FIELDS = 80;
export const PIM_IMPORT_MAX_CELL_CHARS = 20_000;
export const PIM_IMPORT_MAX_ROWS = 500;

const productImportCellInput = z.union([
  z.string().max(PIM_IMPORT_MAX_CELL_CHARS),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const productImportRowDataInput = z.record(
  z.string().trim().min(1).max(128),
  productImportCellInput,
).superRefine((data, context) => {
  if (Object.keys(data).length > PIM_IMPORT_MAX_ROW_FIELDS) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Import rows may contain at most ${PIM_IMPORT_MAX_ROW_FIELDS} fields.`,
    });
  }
});

export const catalogProductStatusInput = z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']);
export const brandStatusInput = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);
export const productSkuStatusInput = z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']);
export const productAttributeValueTypeInput = z.enum(['TEXT', 'NUMBER', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'DIMENSION']);
export const productSpecificationScopeInput = z.enum(['PRODUCT', 'VARIANT']);
export const productMediaRoleInput = z.enum(['HERO', 'GALLERY', 'VIDEO']);
export const productImportFormatInput = z.enum(['CSV', 'XLSX']);
export const productImportStatusInput = z.enum(['UPLOADED', 'VALIDATING', 'READY', 'APPLYING', 'COMPLETED', 'FAILED', 'ROLLED_BACK']);

export const adminPageQuery = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  query: z.string().trim().min(1).max(160).optional(),
});

export const productListQuery = adminPageQuery.extend({
  status: catalogProductStatusInput.optional(),
  categoryId: cuid.optional(),
  brandId: cuid.optional(),
  includeArchived: z.preprocess((value) => value === 'true' ? true : value === 'false' ? false : value, z.boolean()).optional(),
});

export const entityIdInput = z.object({ id: cuid });
export const productIdInput = entityIdInput;
export const productVariantIdInput = z.object({ id: cuid, variantId: cuid });
export const productMediaIdInput = z.object({ id: cuid, mediaId: cuid });

export const seoInput = z.object({
  metaTitle: z.string().trim().max(70).nullable().optional(),
  metaDescription: z.string().trim().max(170).nullable().optional(),
  canonicalUrl: z.string().url().max(2_048).nullable().optional(),
  schemaData: z.record(z.unknown()).nullable().optional(),
  noIndex: z.boolean().optional(),
}).strict();

export const createBrandInput = z.object({
  code,
  slug,
  name: z.string().trim().min(2).max(160),
  logoMediaId: cuid.nullable().optional(),
  description: nullableText.optional(),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(170).nullable().optional(),
  canonicalUrl: z.string().url().max(2_048).nullable().optional(),
  schemaData: z.record(z.unknown()).nullable().optional(),
  status: brandStatusInput.default('DRAFT'),
}).strict();

export const updateBrandInput = createBrandInput.partial().extend({
  version: z.number().int().min(1).optional(),
}).strict();

export const createCategoryInput = z.object({
  parentId: cuid.nullable().optional(),
  imageMediaId: cuid.nullable().optional(),
  slug,
  name: z.string().trim().min(2).max(160),
  description: nullableText.optional(),
  imageUrl: z.string().url().max(2_048).nullable().optional(),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(170).nullable().optional(),
  canonicalUrl: z.string().url().max(2_048).nullable().optional(),
  schemaData: z.record(z.unknown()).nullable().optional(),
  sortOrder: z.number().int().min(-10_000).max(10_000).default(0),
  isActive: z.boolean().default(true),
}).strict();

export const updateCategoryInput = createCategoryInput.partial().strict();

export const createWarrantyInput = z.object({
  code,
  provider: z.string().trim().min(2).max(160),
  name: z.string().trim().min(2).max(160),
  durationMonths: z.number().int().min(0).max(120),
  terms: nullableText.optional(),
  conditions: nullableText.optional(),
  isActive: z.boolean().default(true),
}).strict();

export const updateWarrantyInput = createWarrantyInput.partial().strict();

export const createSpecificationGroupInput = z.object({
  code,
  name: z.string().trim().min(2).max(160),
  description: nullableText.optional(),
  sortOrder: z.number().int().min(-10_000).max(10_000).default(0),
  isActive: z.boolean().default(true),
}).strict();

export const updateSpecificationGroupInput = createSpecificationGroupInput.partial().strict();

export const createProductAttributeInput = z.object({
  groupId: cuid.nullable().optional(),
  code,
  name: z.string().trim().min(2).max(160),
  valueType: productAttributeValueTypeInput,
  unitCode: z.string().trim().min(1).max(32).nullable().optional(),
  description: nullableText.optional(),
  isFilterable: z.boolean().default(false),
  isSearchable: z.boolean().default(true),
  isRequiredDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(-10_000).max(10_000).default(0),
  isActive: z.boolean().default(true),
}).strict();

export const updateProductAttributeInput = createProductAttributeInput.partial().strict();

export const createAttributeValueInput = z.object({
  attributeId: cuid,
  code,
  label: z.string().trim().min(1).max(160),
  sortOrder: z.number().int().min(-10_000).max(10_000).default(0),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).nullable().optional(),
}).strict();

export const categoryAttributeAssignmentInput = z.object({
  attributeId: cuid,
  groupId: cuid.nullable().optional(),
  isRequired: z.boolean().default(false),
  isFilterable: z.boolean().default(false),
  sortOrder: z.number().int().min(-10_000).max(10_000).default(0),
}).strict();

const productVariantFields = z.object({
  skuCode: code,
  barcode: z.string().trim().min(3).max(160).nullable().optional(),
  title: z.string().trim().min(1).max(200).nullable().optional(),
  color: z.string().trim().min(1).max(80).nullable().optional(),
  storage: z.string().trim().min(1).max(80).nullable().optional(),
  region: z.string().trim().min(1).max(80).nullable().optional(),
  modelNumber: z.string().trim().min(1).max(80).nullable().optional(),
  optionKey: z.string().trim().min(1).max(180).nullable().optional(),
  warrantyId: cuid.nullable().optional(),
  warranty: z.string().trim().min(1).max(160).nullable().optional(),
  priceRials: money,
  compareAtPriceRials: money.nullable().optional(),
  costRials: money.nullable().optional(),
  status: productSkuStatusInput.default('ACTIVE'),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(-10_000).max(10_000).default(0),
}).strict();

function validateVariantPrices(
  value: Pick<z.output<typeof productVariantFields>, 'compareAtPriceRials' | 'priceRials'>,
  context: z.RefinementCtx,
): void {
  if (value.compareAtPriceRials !== null && value.compareAtPriceRials !== undefined && value.compareAtPriceRials < value.priceRials) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['compareAtPriceRials'], message: 'Compare-at price cannot be lower than price.' });
  }
}

export const productVariantInput = productVariantFields.superRefine(validateVariantPrices);

export const updateProductVariantInput = productVariantFields.partial().extend({
  version: z.number().int().min(1),
}).strict().superRefine((value, context) => {
  if (value.priceRials === undefined || value.compareAtPriceRials === undefined) return;
  validateVariantPrices(value as z.output<typeof productVariantFields>, context);
});

export const productSpecificationInput = z.object({
  attributeId: cuid,
  attributeValueId: cuid.nullable().optional(),
  scope: productSpecificationScopeInput.default('PRODUCT'),
  variantSkuCode: code.optional(),
  value: z.unknown().nullable().optional(),
  displayValue: z.string().trim().min(1).max(1_000),
  unitCode: z.string().trim().min(1).max(32).nullable().optional(),
  sortOrder: z.number().int().min(-10_000).max(10_000).default(0),
}).strict().superRefine((value, context) => {
  if (value.scope === 'VARIANT' && value.variantSkuCode === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['variantSkuCode'], message: 'Variant specifications require a variant SKU code.' });
  }
  if (value.scope === 'PRODUCT' && value.variantSkuCode !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['variantSkuCode'], message: 'Product specifications cannot target a variant.' });
  }
});

export const productSpecificationsInput = z.object({
  specifications: z.array(productSpecificationInput).min(1).max(300),
}).strict();

export const createProductInput = z.object({
  categoryId: cuid.nullable().optional(),
  brandId: cuid.nullable().optional(),
  slug,
  name: z.string().trim().min(2).max(220),
  summary: z.string().trim().min(1).max(1_000).nullable().optional(),
  description: nullableText.optional(),
  isFeatured: z.boolean().default(false),
  featuredRank: z.number().int().min(0).max(1_000_000).nullable().optional(),
  isNew: z.boolean().default(false),
  isOnSale: z.boolean().default(false),
  seo: seoInput.optional(),
  variants: z.array(productVariantInput).max(100).default([]),
  specifications: z.array(productSpecificationInput).max(300).default([]),
}).strict().superRefine((value, context) => {
  const codes = value.variants.map((variant) => variant.skuCode);
  if (new Set(codes).size !== codes.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['variants'], message: 'SKU codes must be unique within the product.' });
  }
});

export const updateProductInput = z.object({
  version: z.number().int().min(1),
  categoryId: cuid.nullable().optional(),
  brandId: cuid.nullable().optional(),
  slug: slug.optional(),
  name: z.string().trim().min(2).max(220).optional(),
  summary: z.string().trim().min(1).max(1_000).nullable().optional(),
  description: nullableText.optional(),
  isFeatured: z.boolean().optional(),
  featuredRank: z.number().int().min(0).max(1_000_000).nullable().optional(),
  isNew: z.boolean().optional(),
  isOnSale: z.boolean().optional(),
  seo: seoInput.optional(),
}).strict().refine((value) => Object.keys(value).some((key) => key !== 'version'), { message: 'At least one product field must change.' });

export const productWorkflowInput = z.object({
  version: z.number().int().min(1),
  note: z.string().trim().min(1).max(1_000).optional(),
}).strict();

export const productMediaInput = z.object({
  mediaId: cuid,
  variantId: cuid.nullable().optional(),
  role: productMediaRoleInput.default('GALLERY'),
  altText: z.string().trim().min(1).max(250).nullable().optional(),
  caption: z.string().trim().min(1).max(500).nullable().optional(),
  sortOrder: z.number().int().min(-10_000).max(10_000).default(0),
}).strict();

export const productImportPreviewInput = z.object({
  format: productImportFormatInput,
  originalFileName: z.string().trim().min(1).max(255),
  sourceChecksum: z.string().trim().regex(/^[A-Fa-f0-9]{64}$/).optional(),
  sourceFileId: cuid.optional(),
  rows: z.array(z.object({ rowNumber: z.number().int().min(1).max(1_000_000), data: productImportRowDataInput }).strict()).min(1).max(PIM_IMPORT_MAX_ROWS),
}).strict();

export const productImportListQuery = adminPageQuery.extend({
  status: productImportStatusInput.optional(),
});

export const productImportApplyInput = z.object({
  dryRun: z.literal(false).optional(),
}).strict();

export type ProductListQuery = z.output<typeof productListQuery>;
export type CreateBrandInput = z.output<typeof createBrandInput>;
export type UpdateBrandInput = z.output<typeof updateBrandInput>;
export type CreateCategoryInput = z.output<typeof createCategoryInput>;
export type UpdateCategoryInput = z.output<typeof updateCategoryInput>;
export type CreateWarrantyInput = z.output<typeof createWarrantyInput>;
export type UpdateWarrantyInput = z.output<typeof updateWarrantyInput>;
export type CreateSpecificationGroupInput = z.output<typeof createSpecificationGroupInput>;
export type UpdateSpecificationGroupInput = z.output<typeof updateSpecificationGroupInput>;
export type CreateProductAttributeInput = z.output<typeof createProductAttributeInput>;
export type UpdateProductAttributeInput = z.output<typeof updateProductAttributeInput>;
export type CreateAttributeValueInput = z.output<typeof createAttributeValueInput>;
export type CategoryAttributeAssignmentInput = z.output<typeof categoryAttributeAssignmentInput>;
export type ProductVariantInput = z.output<typeof productVariantInput>;
export type UpdateProductVariantInput = z.output<typeof updateProductVariantInput>;
export type ProductSpecificationInput = z.output<typeof productSpecificationInput>;
export type ProductSpecificationsInput = z.output<typeof productSpecificationsInput>;
export type CreateProductInput = z.output<typeof createProductInput>;
export type UpdateProductInput = z.output<typeof updateProductInput>;
export type ProductWorkflowInput = z.output<typeof productWorkflowInput>;
export type ProductMediaInput = z.output<typeof productMediaInput>;
export type ProductImportPreviewInput = z.output<typeof productImportPreviewInput>;
export type ProductImportApplyInput = z.output<typeof productImportApplyInput>;
export type ProductImportListQuery = z.output<typeof productImportListQuery>;
