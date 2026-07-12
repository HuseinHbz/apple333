import type { Prisma } from '@prisma/client';

import type { CatalogPageQuery } from '@/modules/catalog/validators';
import { prisma } from '@/server/db/prisma';

const publicMediaSelect = {
  mediaId: true,
  role: true,
  altText: true,
  sortOrder: true,
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
  sortOrder: true,
  inventory: { select: publicInventorySelect },
} satisfies Prisma.CatalogVariantSelect;

export const publicProductSelect = {
  id: true,
  slug: true,
  name: true,
  brand: true,
  summary: true,
  description: true,
  specifications: true,
  isFeatured: true,
  isNew: true,
  isOnSale: true,
  publishedAt: true,
  category: {
    select: { id: true, slug: true, name: true, description: true, imageUrl: true, isActive: true },
  },
  media: { orderBy: { sortOrder: 'asc' }, select: publicMediaSelect },
  variants: { orderBy: { sortOrder: 'asc' }, select: publicVariantSelect },
} satisfies Prisma.CatalogProductSelect;

export type PublicProductRecord = Prisma.CatalogProductGetPayload<{
  select: typeof publicProductSelect;
}>;

export type PublicVariantRecord = Prisma.CatalogVariantGetPayload<{
  select: typeof publicVariantSelect;
}>;

function productOrder(sort: CatalogPageQuery['sort']): Prisma.CatalogProductOrderByWithRelationInput[] {
  if (sort === 'newest') return [{ publishedAt: 'desc' }, { name: 'asc' }];
  if (sort === 'name') return [{ name: 'asc' }];
  return [{ isFeatured: 'desc' }, { featuredRank: 'asc' }, { publishedAt: 'desc' }, { name: 'asc' }];
}

function productWhere(query: CatalogPageQuery): Prisma.CatalogProductWhereInput {
  const variantCriteria: Prisma.CatalogVariantWhereInput = {
    isActive: true,
    ...(query.color === undefined ? {} : { color: { equals: query.color, mode: 'insensitive' } }),
    ...(query.storage === undefined ? {} : { storage: { equals: query.storage, mode: 'insensitive' } }),
    ...((query.minPriceRials === undefined && query.maxPriceRials === undefined)
      ? {}
      : { priceRials: { ...(query.minPriceRials === undefined ? {} : { gte: query.minPriceRials }), ...(query.maxPriceRials === undefined ? {} : { lte: query.maxPriceRials }) } }),
    ...(query.inStock
      ? {
        inventory: {
          some: {
            branch: { is: { isActive: true } },
            onHand: { gt: prisma.branchInventory.fields.reserved },
          },
        },
      }
      : {}),
  };

  return {
    status: 'PUBLISHED',
    ...(query.collection === undefined
      ? {}
      : query.collection === 'featured'
        ? { isFeatured: true }
        : query.collection === 'new'
          ? { isNew: true }
          : { isOnSale: true }),
    ...(query.category === undefined ? {} : { category: { is: { slug: query.category, isActive: true } } }),
    ...(query.query === undefined ? {} : {
      OR: [
        { name: { contains: query.query, mode: 'insensitive' } },
        { brand: { contains: query.query, mode: 'insensitive' } },
        { summary: { contains: query.query, mode: 'insensitive' } },
        { slug: { contains: query.query, mode: 'insensitive' } },
      ],
    }),
    variants: { some: variantCriteria },
  };
}

export const catalogRepository = {
  listCategories() {
    return prisma.catalogCategory.findMany({
      where: { isActive: true },
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
      where: { slug, status: 'PUBLISHED' },
      select: publicProductSelect,
    });
  },

  findPublicBySlugs(slugs: readonly string[]): Promise<PublicProductRecord[]> {
    return prisma.catalogProduct.findMany({
      where: { slug: { in: [...slugs] }, status: 'PUBLISHED' },
      select: publicProductSelect,
    });
  },

  findPublicMedia(productId: string, mediaId: string) {
    return prisma.productMedia.findFirst({
      where: {
        productId,
        mediaId,
        product: { is: { status: 'PUBLISHED' } },
        media: { is: { deletedAt: null } },
      },
      select: {
        media: { select: { storageKey: true, contentType: true, originalName: true } },
      },
    });
  },
};
