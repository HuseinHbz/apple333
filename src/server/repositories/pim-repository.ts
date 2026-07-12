import type { Prisma } from '@prisma/client';

import type { ProductListQuery } from '@/modules/pim/validators';
import type { AdminDatabaseClient } from '@/server/admin/database';
import { prisma } from '@/server/db/prisma';

const brandSummarySelect = {
  id: true,
  name: true,
} satisfies Prisma.BrandSelect;

const categorySummarySelect = {
  id: true,
  name: true,
  slug: true,
} satisfies Prisma.CatalogCategorySelect;

const warrantySummarySelect = {
  id: true,
  name: true,
  provider: true,
} satisfies Prisma.WarrantySelect;

const skuSelect = {
  id: true,
  code: true,
  barcode: true,
  priceRials: true,
  compareAtPriceRials: true,
  costRials: true,
  status: true,
  version: true,
  deletedAt: true,
} satisfies Prisma.ProductSkuSelect;

const variantDetailSelect = {
  id: true,
  sku: true,
  title: true,
  color: true,
  storage: true,
  region: true,
  modelNumber: true,
  optionKey: true,
  isActive: true,
  deletedAt: true,
  version: true,
  sortOrder: true,
  warrantyRecord: { select: warrantySummarySelect },
  skuRecord: { select: skuSelect },
} satisfies Prisma.CatalogVariantSelect;

const productMediaDetailSelect = {
  id: true,
  mediaId: true,
  variantId: true,
  role: true,
  altText: true,
  caption: true,
  sortOrder: true,
  media: {
    select: {
      originalName: true,
      contentType: true,
      kind: true,
      deletedAt: true,
    },
  },
} satisfies Prisma.ProductMediaSelect;

const specificationDetailSelect = {
  id: true,
  scope: true,
  subjectKey: true,
  displayValue: true,
  value: true,
  unitCode: true,
  sortOrder: true,
  attribute: { select: { id: true, code: true, name: true, valueType: true } },
  attributeValue: { select: { id: true, code: true, label: true } },
} satisfies Prisma.ProductSpecificationSelect;

export const adminProductListSelect = {
  id: true,
  slug: true,
  name: true,
  brand: true,
  status: true,
  version: true,
  updatedAt: true,
  brandRecord: { select: brandSummarySelect },
  category: { select: categorySummarySelect },
  _count: { select: { variants: true } },
  variants: { where: { isActive: true, deletedAt: null }, select: { id: true } },
} satisfies Prisma.CatalogProductSelect;

export const adminProductDetailSelect = {
  ...adminProductListSelect,
  summary: true,
  description: true,
  isFeatured: true,
  featuredRank: true,
  isNew: true,
  isOnSale: true,
  submittedForReviewAt: true,
  approvedAt: true,
  publishedAt: true,
  deletedAt: true,
  approvedBy: { select: { id: true, name: true, email: true } },
  seo: { select: { metaTitle: true, metaDescription: true, canonicalUrl: true, schemaData: true, noIndex: true } },
  variants: { orderBy: { sortOrder: 'asc' }, select: variantDetailSelect },
  specificationsStructured: { orderBy: { sortOrder: 'asc' }, select: specificationDetailSelect },
  media: { orderBy: { sortOrder: 'asc' }, select: productMediaDetailSelect },
} satisfies Prisma.CatalogProductSelect;

export type AdminProductListRecord = Prisma.CatalogProductGetPayload<{
  select: typeof adminProductListSelect;
}>;

export type AdminProductDetailRecord = Prisma.CatalogProductGetPayload<{
  select: typeof adminProductDetailSelect;
}>;

const brandDetailSelect = {
  id: true,
  code: true,
  slug: true,
  name: true,
  logoMediaId: true,
  description: true,
  status: true,
  deletedAt: true,
  updatedAt: true,
  _count: { select: { products: true } },
} satisfies Prisma.BrandSelect;

export type BrandRecord = Prisma.BrandGetPayload<{ select: typeof brandDetailSelect }>;

const categoryDetailSelect = {
  id: true,
  parentId: true,
  slug: true,
  name: true,
  description: true,
  imageMediaId: true,
  imageUrl: true,
  isActive: true,
  sortOrder: true,
  deletedAt: true,
  updatedAt: true,
  _count: { select: { products: true, children: true } },
} satisfies Prisma.CatalogCategorySelect;

export type CategoryRecord = Prisma.CatalogCategoryGetPayload<{ select: typeof categoryDetailSelect }>;

const warrantyDetailSelect = {
  id: true,
  code: true,
  provider: true,
  name: true,
  durationMonths: true,
  terms: true,
  conditions: true,
  isActive: true,
  deletedAt: true,
  updatedAt: true,
  _count: { select: { variants: true } },
} satisfies Prisma.WarrantySelect;

export type WarrantyRecord = Prisma.WarrantyGetPayload<{ select: typeof warrantyDetailSelect }>;

const specificationGroupSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  sortOrder: true,
  isActive: true,
  updatedAt: true,
  _count: { select: { attributes: true } },
} satisfies Prisma.SpecificationGroupSelect;

export type SpecificationGroupRecord = Prisma.SpecificationGroupGetPayload<{ select: typeof specificationGroupSelect }>;

const productAttributeSelect = {
  id: true,
  groupId: true,
  code: true,
  name: true,
  valueType: true,
  unitCode: true,
  isFilterable: true,
  isSearchable: true,
  isRequiredDefault: true,
  sortOrder: true,
  isActive: true,
  updatedAt: true,
  _count: { select: { values: true } },
} satisfies Prisma.ProductAttributeSelect;

export type ProductAttributeRecord = Prisma.ProductAttributeGetPayload<{ select: typeof productAttributeSelect }>;

function productWhere(query: ProductListQuery): Prisma.CatalogProductWhereInput {
  return {
    ...(query.includeArchived ? {} : { deletedAt: null }),
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
    ...(query.brandId === undefined ? {} : { brandId: query.brandId }),
    ...(query.query === undefined ? {} : {
      OR: [
        { name: { contains: query.query, mode: 'insensitive' } },
        { slug: { contains: query.query, mode: 'insensitive' } },
        { brand: { contains: query.query, mode: 'insensitive' } },
        { searchText: { contains: query.query, mode: 'insensitive' } },
        { variants: { some: { sku: { contains: query.query, mode: 'insensitive' } } } },
        { variants: { some: { skuRecord: { is: { code: { contains: query.query, mode: 'insensitive' } } } } } },
      ],
    }),
  };
}

export const pimRepository = {
  async findProductPage(query: ProductListQuery, client: AdminDatabaseClient = prisma): Promise<Readonly<{ items: readonly AdminProductListRecord[]; total: number }>> {
    const where = productWhere(query);
    const [items, total] = await Promise.all([
      client.catalogProduct.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: adminProductListSelect,
      }),
      client.catalogProduct.count({ where }),
    ]);
    return { items, total };
  },

  findProductById(productId: string, client: AdminDatabaseClient = prisma): Promise<AdminProductDetailRecord | null> {
    return client.catalogProduct.findUnique({ where: { id: productId }, select: adminProductDetailSelect });
  },

  findProductWorkflowState(productId: string, client: AdminDatabaseClient = prisma) {
    return client.catalogProduct.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        slug: true,
        brand: true,
        status: true,
        version: true,
        deletedAt: true,
        category: { select: { isActive: true, deletedAt: true } },
        brandRecord: { select: { status: true, deletedAt: true } },
        variants: { select: { id: true, sku: true, optionKey: true, isActive: true, deletedAt: true, skuRecord: { select: { code: true, status: true, deletedAt: true, priceRials: true } } } },
      },
    });
  },

  findVariant(productId: string, variantId: string, client: AdminDatabaseClient = prisma) {
    return client.catalogVariant.findFirst({
      where: { id: variantId, productId },
      select: {
        id: true,
        productId: true,
        sku: true,
        title: true,
        color: true,
        storage: true,
        region: true,
        modelNumber: true,
        optionKey: true,
        warrantyId: true,
        warranty: true,
        version: true,
        isActive: true,
        deletedAt: true,
        skuRecord: { select: skuSelect },
      },
    });
  },

  findBrandById(brandId: string, client: AdminDatabaseClient = prisma) {
    return client.brand.findUnique({ where: { id: brandId }, select: brandDetailSelect });
  },

  findActiveBrand(brandId: string, client: AdminDatabaseClient = prisma) {
    return client.brand.findFirst({ where: { id: brandId, status: 'ACTIVE', deletedAt: null }, select: { id: true, name: true } });
  },

  async findBrandPage(query: ProductListQuery, client: AdminDatabaseClient = prisma): Promise<Readonly<{ items: readonly BrandRecord[]; total: number }>> {
    const where: Prisma.BrandWhereInput = {
      deletedAt: null,
      ...(query.query === undefined ? {} : { OR: [{ name: { contains: query.query, mode: 'insensitive' } }, { code: { contains: query.query, mode: 'insensitive' } }, { slug: { contains: query.query, mode: 'insensitive' } }] }),
    };
    const [items, total] = await Promise.all([
      client.brand.findMany({ where, orderBy: { name: 'asc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: brandDetailSelect }),
      client.brand.count({ where }),
    ]);
    return { items, total };
  },

  findCategoryById(categoryId: string, client: AdminDatabaseClient = prisma) {
    return client.catalogCategory.findUnique({ where: { id: categoryId }, select: categoryDetailSelect });
  },

  findActiveCategory(categoryId: string, client: AdminDatabaseClient = prisma) {
    return client.catalogCategory.findFirst({ where: { id: categoryId, isActive: true, deletedAt: null }, select: { id: true, name: true } });
  },

  async findCategoryPage(query: ProductListQuery, client: AdminDatabaseClient = prisma): Promise<Readonly<{ items: readonly CategoryRecord[]; total: number }>> {
    const where: Prisma.CatalogCategoryWhereInput = {
      deletedAt: null,
      ...(query.query === undefined ? {} : { OR: [{ name: { contains: query.query, mode: 'insensitive' } }, { slug: { contains: query.query, mode: 'insensitive' } }] }),
    };
    const [items, total] = await Promise.all([
      client.catalogCategory.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: categoryDetailSelect }),
      client.catalogCategory.count({ where }),
    ]);
    return { items, total };
  },

  findWarrantyById(warrantyId: string, client: AdminDatabaseClient = prisma) {
    return client.warranty.findUnique({ where: { id: warrantyId }, select: warrantyDetailSelect });
  },

  findActiveWarranty(warrantyId: string, client: AdminDatabaseClient = prisma) {
    return client.warranty.findFirst({ where: { id: warrantyId, isActive: true, deletedAt: null }, select: { id: true, name: true, provider: true } });
  },

  async findWarrantyPage(query: ProductListQuery, client: AdminDatabaseClient = prisma): Promise<Readonly<{ items: readonly WarrantyRecord[]; total: number }>> {
    const where: Prisma.WarrantyWhereInput = {
      deletedAt: null,
      ...(query.query === undefined ? {} : { OR: [{ name: { contains: query.query, mode: 'insensitive' } }, { provider: { contains: query.query, mode: 'insensitive' } }, { code: { contains: query.query, mode: 'insensitive' } }] }),
    };
    const [items, total] = await Promise.all([
      client.warranty.findMany({ where, orderBy: [{ provider: 'asc' }, { name: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: warrantyDetailSelect }),
      client.warranty.count({ where }),
    ]);
    return { items, total };
  },

  async findSpecificationGroups(query: ProductListQuery, client: AdminDatabaseClient = prisma): Promise<Readonly<{ items: readonly SpecificationGroupRecord[]; total: number }>> {
    const where: Prisma.SpecificationGroupWhereInput = {
      deletedAt: null,
      ...(query.query === undefined ? {} : { OR: [{ name: { contains: query.query, mode: 'insensitive' } }, { code: { contains: query.query, mode: 'insensitive' } }] }),
    };
    const [items, total] = await Promise.all([
      client.specificationGroup.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: specificationGroupSelect }),
      client.specificationGroup.count({ where }),
    ]);
    return { items, total };
  },

  async findProductAttributes(query: ProductListQuery, client: AdminDatabaseClient = prisma): Promise<Readonly<{ items: readonly ProductAttributeRecord[]; total: number }>> {
    const where: Prisma.ProductAttributeWhereInput = {
      deletedAt: null,
      ...(query.query === undefined ? {} : { OR: [{ name: { contains: query.query, mode: 'insensitive' } }, { code: { contains: query.query, mode: 'insensitive' } }] }),
    };
    const [items, total] = await Promise.all([
      client.productAttribute.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: productAttributeSelect }),
      client.productAttribute.count({ where }),
    ]);
    return { items, total };
  },

  findActiveAttribute(attributeId: string, client: AdminDatabaseClient = prisma) {
    return client.productAttribute.findFirst({ where: { id: attributeId, isActive: true, deletedAt: null }, select: { id: true, valueType: true } });
  },

  findActiveAttributeValue(attributeValueId: string, client: AdminDatabaseClient = prisma) {
    return client.attributeValue.findFirst({ where: { id: attributeValueId, isActive: true, deletedAt: null }, select: { id: true, attributeId: true } });
  },

  findMediaForAssociation(mediaId: string, client: AdminDatabaseClient = prisma) {
    return client.mediaFile.findFirst({ where: { id: mediaId, deletedAt: null }, select: { id: true, kind: true } });
  },
};
