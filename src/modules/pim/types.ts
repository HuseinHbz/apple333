export type AdminBrandDto = Readonly<{
  id: string;
  code: string;
  slug: string;
  name: string;
  logoMediaId: string | null;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  deletedAt: string | null;
  updatedAt: string;
}>;

export type AdminCategoryDto = Readonly<{
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  description: string | null;
  imageMediaId: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  deletedAt: string | null;
  productCount: number;
  childCount: number;
  updatedAt: string;
}>;

export type AdminWarrantyDto = Readonly<{
  id: string;
  code: string;
  provider: string;
  name: string;
  durationMonths: number;
  terms: string | null;
  conditions: string | null;
  isActive: boolean;
  deletedAt: string | null;
  variantCount: number;
  updatedAt: string;
}>;

export type AdminProductSkuDto = Readonly<{
  id: string;
  code: string;
  barcode: string | null;
  priceRials: string;
  compareAtPriceRials: string | null;
  costRials: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  version: number;
  deletedAt: string | null;
}>;

export type AdminProductVariantDto = Readonly<{
  id: string;
  sku: string;
  title: string | null;
  color: string | null;
  storage: string | null;
  region: string | null;
  modelNumber: string | null;
  optionKey: string | null;
  warranty: Readonly<{ id: string; name: string; provider: string }> | null;
  isActive: boolean;
  deletedAt: string | null;
  version: number;
  sortOrder: number;
  skuRecord: AdminProductSkuDto | null;
}>;

export type AdminProductSpecificationDto = Readonly<{
  id: string;
  scope: 'PRODUCT' | 'VARIANT';
  subjectKey: string;
  displayValue: string;
  value: unknown | null;
  unitCode: string | null;
  sortOrder: number;
  attribute: Readonly<{ id: string; code: string; name: string; valueType: string }>;
  attributeValue: Readonly<{ id: string; code: string; label: string }> | null;
}>;

export type AdminProductMediaDto = Readonly<{
  id: string;
  mediaId: string;
  variantId: string | null;
  role: 'HERO' | 'GALLERY' | 'VIDEO';
  altText: string | null;
  caption: string | null;
  sortOrder: number;
  media: Readonly<{ originalName: string; contentType: string; kind: 'IMAGE' | 'VIDEO' | 'DOCUMENT'; deletedAt: string | null }>;
}>;

export type AdminProductListItemDto = Readonly<{
  id: string;
  slug: string;
  name: string;
  brand: Readonly<{ id: string; name: string }> | null;
  legacyBrand: string;
  category: Readonly<{ id: string; name: string; slug: string }> | null;
  status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  version: number;
  variantCount: number;
  activeVariantCount: number;
  updatedAt: string;
}>;

export type AdminProductDetailDto = AdminProductListItemDto & Readonly<{
  summary: string | null;
  description: string | null;
  isFeatured: boolean;
  featuredRank: number | null;
  isNew: boolean;
  isOnSale: boolean;
  submittedForReviewAt: string | null;
  approvedAt: string | null;
  approvedBy: Readonly<{ id: string; name: string | null; email: string | null }> | null;
  publishedAt: string | null;
  deletedAt: string | null;
  seo: Readonly<{ metaTitle: string | null; metaDescription: string | null; canonicalUrl: string | null; noIndex: boolean; schemaData: unknown | null }> | null;
  variants: readonly AdminProductVariantDto[];
  specifications: readonly AdminProductSpecificationDto[];
  media: readonly AdminProductMediaDto[];
}>;

export type AdminSpecificationGroupDto = Readonly<{
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  attributeCount: number;
  updatedAt: string;
}>;

export type AdminProductAttributeDto = Readonly<{
  id: string;
  groupId: string | null;
  code: string;
  name: string;
  valueType: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT' | 'DIMENSION';
  unitCode: string | null;
  isFilterable: boolean;
  isSearchable: boolean;
  isRequiredDefault: boolean;
  sortOrder: number;
  isActive: boolean;
  valueCount: number;
  updatedAt: string;
}>;

export type ProductImportPreviewDto = Readonly<{
  id: string;
  status: 'UPLOADED' | 'VALIDATING' | 'READY' | 'APPLYING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  totalRows: number;
  validRows: number;
  failedRows: number;
  errors: readonly Readonly<{ rowNumber: number; messages: readonly string[] }>[];
}>;

export type AdminProductImportDto = Readonly<{
  id: string;
  format: 'CSV' | 'XLSX';
  status: ProductImportPreviewDto['status'];
  originalFileName: string;
  totalRows: number;
  validRows: number;
  failedRows: number;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;
