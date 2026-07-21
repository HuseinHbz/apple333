import type { Prisma } from '@prisma/client';

import type { CatalogPageQuery } from '@/modules/catalog/validators';
import { prisma } from '@/server/db/prisma';

const publicMediaSelect = {
  mediaId: true,
  role: true,
  altText: true,
  sortOrder: true,
  variant: {
    select: {
      isActive: true,
      deletedAt: true,
    },
  },
  media: {
    select: {
      id: true,
      contentType: true,
      deletedAt: true,
    },
  },
} satisfies Prisma.ProductMediaSelect;

const publicInventorySelect = {
  onHand: true,
  reserved: true,
  branch: {
    select: {
      id: true,
      name: true,
      city: true,
      isActive: true,
      status: true,
      isPickupEnabled: true,
    },
  },
} satisfies Prisma.BranchInventorySelect;

const publicVariantSelect = {
  id: true,
  sku: true,
  title: true,
  color: true,
  storage: true,
  region: true,
  warranty: true,
  priceRials: true,
  compareAtPriceRials: true,
  isActive: true,
  deletedAt: true,
  sortOrder: true,
  skuRecord: {
    select: {
      status: true,
      deletedAt: true,
    },
  },
  inventory: { select: publicInventorySelect },
} satisfies Prisma.CatalogVariantSelect;

const publicVariantWhere = {
  isActive: true,
  deletedAt: null,
  skuRecord: {
    is: {
      status: 'ACTIVE',
      deletedAt: null,
    },
  },
} satisfies Prisma.CatalogVariantWhereInput;

const publicMediaWhere = {
  media: { is: { deletedAt: null } },
  OR: [
    { variantId: null },
    { variant: { is: publicVariantWhere } },
  ],
} satisfies Prisma.ProductMediaWhereInput;

const publicProductVisibilityWhere = {
  status: 'PUBLISHED',
  deletedAt: null,
  category: { is: { isActive: true, deletedAt: null } },
} satisfies Prisma.CatalogProductWhereInput;

const publicProductWithSellableVariantWhere = {
  ...publicProductVisibilityWhere,
  variants: { some: publicVariantWhere },
} satisfies Prisma.CatalogProductWhereInput;

export const publicProductSelect = {
  id: true,
  slug: true,
  name: true,
  brand: true,
  summary: true,
  description: true,
  specifications: true,
  seoTitle: true,
  seoDescription: true,
  isFeatured: true,
  isNew: true,
  isOnSale: true,
  publishedAt: true,
  category: {
    select: { id: true, slug: true, name: true, description: true, imageUrl: true, isActive: true, deletedAt: true },
  },
  seo: {
    select: {
      metaTitle: true,
      metaDescription: true,
      canonicalUrl: true,
      noIndex: true,
    },
  },
  media: { where: publicMediaWhere, orderBy: { sortOrder: 'asc' }, select: publicMediaSelect },
  variants: { where: publicVariantWhere, orderBy: { sortOrder: 'asc' }, select: publicVariantSelect },
} satisfies Prisma.CatalogProductSelect;

export type PublicProductRecord = Prisma.CatalogProductGetPayload<{
  select: typeof publicProductSelect;
}>;

export type PublicVariantRecord = Prisma.CatalogVariantGetPayload<{
  select: typeof publicVariantSelect;
}>;

const publicSitemapSelect = {
  slug: true,
  updatedAt: true,
  seo: { select: { noIndex: true } },
} satisfies Prisma.CatalogProductSelect;

export type PublicSitemapRecord = Prisma.CatalogProductGetPayload<{
  select: typeof publicSitemapSelect;
}>;

function productOrder(sort: CatalogPageQuery['sort']): Prisma.CatalogProductOrderByWithRelationInput[] {
  if (sort === 'newest') return [{ publishedAt: 'desc' }, { name: 'asc' }];
  if (sort === 'name') return [{ name: 'asc' }];
  return [{ isFeatured: 'desc' }, { featuredRank: 'asc' }, { publishedAt: 'desc' }, { name: 'asc' }];
}

function productWhere(query: CatalogPageQuery): Prisma.CatalogProductWhereInput {
  const variantCriteria: Prisma.CatalogVariantWhereInput = {
    ...publicVariantWhere,
    ...(query.color === undefined ? {} : { color: { equals: query.color, mode: 'insensitive' } }),
    ...(query.storage === undefined ? {} : { storage: { equals: query.storage, mode: 'insensitive' } }),
    ...((query.minPriceRials === undefined && query.maxPriceRials === undefined)
      ? {}
      : { priceRials: { ...(query.minPriceRials === undefined ? {} : { gte: query.minPriceRials }), ...(query.maxPriceRials === undefined ? {} : { lte: query.maxPriceRials }) } }),
    ...(query.inStock
      ? {
        inventory: {
          some: {
            branch: { is: { isActive: true, status: 'ACTIVE' } },
            onHand: { gt: prisma.branchInventory.fields.reserved },
          },
        },
      }
      : {}),
  };

  return {
    ...publicProductVisibilityWhere,
    ...(query.collection === undefined
      ? {}
      : query.collection === 'featured'
        ? { isFeatured: true }
        : query.collection === 'new'
          ? { isNew: true }
          : { isOnSale: true }),
    ...(query.brand === undefined ? {} : { brand: { equals: query.brand, mode: 'insensitive' } }),
    ...(query.category === undefined ? {} : { category: { is: { slug: query.category, isActive: true, deletedAt: null } } }),
    ...(query.query === undefined ? {} : {
      OR: [
        { name: { contains: query.query, mode: 'insensitive' } },
        { brand: { contains: query.query, mode: 'insensitive' } },
        { summary: { contains: query.query, mode: 'insensitive' } },
        { slug: { contains: query.query, mode: 'insensitive' } },
      ],
    }),
    ...(query.model === undefined
      ? {}
      : {
        AND: [{
          OR: [
            { name: { contains: query.model, mode: 'insensitive' } },
            { slug: { contains: query.model, mode: 'insensitive' } },
            { variants: { some: { ...publicVariantWhere, modelNumber: { contains: query.model, mode: 'insensitive' } } } },
          ],
        }],
      }),
    variants: { some: variantCriteria },
  };
}

export const catalogRepository = {
  listCategories() {
    return prisma.catalogCategory.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, slug: true, name: true, description: true, imageUrl: true },
    });
  },

  async findPublicPage(query: CatalogPageQuery): Promise<Readonly<{ items: readonly PublicProductRecord[]; total: number }>> {
    const where = productWhere(query);
    const [items, total] = await Promise.all([
      prisma.catalogProduct.findMany({
        where,
        orderBy: productOrder(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: publicProductSelect,
      }),
      prisma.catalogProduct.count({ where }),
    ]);
    return { items, total };
  },

  findPublicBySlug(slug: string): Promise<PublicProductRecord | null> {
    return prisma.catalogProduct.findFirst({
      where: { slug, ...publicProductWithSellableVariantWhere },
      select: publicProductSelect,
    });
  },

  findPublicBySlugs(slugs: readonly string[]): Promise<PublicProductRecord[]> {
    return prisma.catalogProduct.findMany({
      where: { slug: { in: [...slugs] }, ...publicProductWithSellableVariantWhere },
      select: publicProductSelect,
    });
  },

  findPublicSitemapEntries({ skip, take }: Readonly<{ skip: number; take: number }>): Promise<PublicSitemapRecord[]> {
    return prisma.catalogProduct.findMany({
      where: publicProductWithSellableVariantWhere,
      orderBy: [{ updatedAt: 'desc' }, { slug: 'asc' }],
      skip,
      take,
      select: publicSitemapSelect,
    });
  },

  findPublicMedia(productId: string, mediaId: string) {
    return prisma.productMedia.findFirst({
      where: {
        productId,
        mediaId,
        product: { is: publicProductWithSellableVariantWhere },
        ...publicMediaWhere,
      },
      select: {
        media: { select: { storageKey: true, contentType: true, originalName: true } },
      },
    });
  },
};
