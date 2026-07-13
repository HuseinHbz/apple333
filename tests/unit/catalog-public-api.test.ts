import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  categoryFindMany: vi.fn(),
  productCount: vi.fn(),
  productFindFirst: vi.fn(),
  productFindMany: vi.fn(),
  productMediaFindFirst: vi.fn(),
}));

vi.mock('@/server/db/prisma', () => ({
  prisma: {
    branchInventory: { fields: { reserved: 'reserved' } },
    catalogCategory: { findMany: mocks.categoryFindMany },
    catalogProduct: {
      count: mocks.productCount,
      findFirst: mocks.productFindFirst,
      findMany: mocks.productFindMany,
    },
    productMedia: { findFirst: mocks.productMediaFindFirst },
  },
}));

import type { PublicProductRecord } from '@/server/repositories/catalog-repository';
import { catalogRepository } from '@/server/repositories/catalog-repository';
import { toPublicProduct } from '@/server/services/catalog-service';

function publicProductRecord(): PublicProductRecord {
  return {
    id: 'product_1',
    slug: 'iphone-16-pro',
    name: 'iPhone 16 Pro',
    brand: 'Apple',
    summary: null,
    description: null,
    specifications: { display: '6.3 inch' },
    seoTitle: ' Legacy iPhone title ',
    seoDescription: ' Legacy iPhone description ',
    isFeatured: true,
    isNew: true,
    isOnSale: false,
    publishedAt: new Date('2026-07-13T00:00:00.000Z'),
    category: {
      id: 'category_1',
      slug: 'iphone',
      name: 'iPhone',
      description: null,
      imageUrl: null,
      isActive: true,
      deletedAt: null,
    },
    seo: {
      metaTitle: ' iPhone 16 Pro | Apple333 ',
      metaDescription: ' Shop iPhone 16 Pro from Apple333. ',
      canonicalUrl: 'https://apple333.example/products/iphone-16-pro',
      noIndex: false,
    },
    media: [
      {
        mediaId: 'media_visible',
        role: 'HERO',
        altText: 'iPhone 16 Pro',
        sortOrder: 0,
        variant: null,
        media: { id: 'media_visible', contentType: 'image/jpeg', deletedAt: null },
      },
      {
        mediaId: 'media_deleted',
        role: 'GALLERY',
        altText: null,
        sortOrder: 1,
        variant: null,
        media: { id: 'media_deleted', contentType: 'image/jpeg', deletedAt: new Date('2026-07-12T00:00:00.000Z') },
      },
      {
        mediaId: 'media_inactive_variant',
        role: 'GALLERY',
        altText: null,
        sortOrder: 2,
        variant: { isActive: false, deletedAt: null },
        media: { id: 'media_inactive_variant', contentType: 'image/jpeg', deletedAt: null },
      },
    ],
    variants: [
      {
        id: 'variant_active',
        sku: 'IPHONE-16-PRO-128',
        title: '128GB',
        color: 'Black',
        storage: '128GB',
        region: null,
        warranty: null,
        priceRials: 1_000_000n,
        compareAtPriceRials: null,
        isActive: true,
        deletedAt: null,
        sortOrder: 0,
        skuRecord: { status: 'ACTIVE', deletedAt: null },
        inventory: [],
      },
      {
        id: 'variant_deleted',
        sku: 'IPHONE-16-PRO-256',
        title: '256GB',
        color: 'Black',
        storage: '256GB',
        region: null,
        warranty: null,
        priceRials: 1_100_000n,
        compareAtPriceRials: null,
        isActive: true,
        deletedAt: new Date('2026-07-12T00:00:00.000Z'),
        sortOrder: 1,
        skuRecord: { status: 'ACTIVE', deletedAt: null },
        inventory: [],
      },
      {
        id: 'variant_inactive_sku',
        sku: 'IPHONE-16-PRO-512',
        title: '512GB',
        color: 'Black',
        storage: '512GB',
        region: null,
        warranty: null,
        priceRials: 1_200_000n,
        compareAtPriceRials: null,
        isActive: true,
        deletedAt: null,
        sortOrder: 2,
        skuRecord: { status: 'INACTIVE', deletedAt: null },
        inventory: [],
      },
      {
        id: 'variant_deleted_sku',
        sku: 'IPHONE-16-PRO-1TB',
        title: '1TB',
        color: 'Black',
        storage: '1TB',
        region: null,
        warranty: null,
        priceRials: 1_300_000n,
        compareAtPriceRials: null,
        isActive: true,
        deletedAt: null,
        sortOrder: 3,
        skuRecord: { status: 'ACTIVE', deletedAt: new Date('2026-07-12T00:00:00.000Z') },
        inventory: [],
      },
    ],
  };
}

describe('public catalog data boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.categoryFindMany.mockResolvedValue([]);
    mocks.productCount.mockResolvedValue(0);
    mocks.productFindFirst.mockResolvedValue(null);
    mocks.productFindMany.mockResolvedValue([]);
    mocks.productMediaFindFirst.mockResolvedValue(null);
  });

  it('uses soft-delete, active-category, active-variant, and active-SKU predicates for public queries', async () => {
    await catalogRepository.listCategories();
    await catalogRepository.findPublicPage({ page: 1, pageSize: 12, sort: 'featured' });
    await catalogRepository.findPublicBySlug('iphone-16-pro');
    await catalogRepository.findPublicBySlugs(['iphone-16-pro']);
    await catalogRepository.findPublicMedia('product_1', 'media_visible');

    expect(mocks.categoryFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true, deletedAt: null },
    }));

    const pageWhere = mocks.productFindMany.mock.calls[0]?.[0]?.where;
    expect(pageWhere).toMatchObject({
      status: 'PUBLISHED',
      deletedAt: null,
      category: { is: { isActive: true, deletedAt: null } },
      variants: {
        some: {
          isActive: true,
          deletedAt: null,
          skuRecord: { is: { status: 'ACTIVE', deletedAt: null } },
        },
      },
    });

    const pageSelect = mocks.productFindMany.mock.calls[0]?.[0]?.select;
    expect(pageSelect).toMatchObject({
      variants: {
        where: {
          isActive: true,
          deletedAt: null,
          skuRecord: { is: { status: 'ACTIVE', deletedAt: null } },
        },
      },
      media: {
        where: {
          media: { is: { deletedAt: null } },
        },
      },
    });

    const slugWhere = mocks.productFindFirst.mock.calls[0]?.[0]?.where;
    expect(slugWhere).toMatchObject({
      slug: 'iphone-16-pro',
      status: 'PUBLISHED',
      deletedAt: null,
      category: { is: { isActive: true, deletedAt: null } },
      variants: { some: { skuRecord: { is: { status: 'ACTIVE', deletedAt: null } } } },
    });

    const comparisonWhere = mocks.productFindMany.mock.calls[1]?.[0]?.where;
    expect(comparisonWhere).toMatchObject({
      slug: { in: ['iphone-16-pro'] },
      status: 'PUBLISHED',
      deletedAt: null,
      variants: { some: { skuRecord: { is: { status: 'ACTIVE', deletedAt: null } } } },
    });

    const mediaWhere = mocks.productMediaFindFirst.mock.calls[0]?.[0]?.where;
    expect(mediaWhere).toMatchObject({
      productId: 'product_1',
      mediaId: 'media_visible',
      media: { is: { deletedAt: null } },
      product: {
        is: {
          status: 'PUBLISHED',
          deletedAt: null,
          category: { is: { isActive: true, deletedAt: null } },
          variants: { some: { skuRecord: { is: { status: 'ACTIVE', deletedAt: null } } } },
        },
      },
    });
    expect(mediaWhere.OR).toEqual(expect.arrayContaining([
      { variantId: null },
      expect.objectContaining({ variant: expect.objectContaining({ is: expect.objectContaining({ deletedAt: null }) }) }),
    ]));
  });

  it('maps only safe nested catalog records and safe SEO fields into the public detail DTO', () => {
    const dto = toPublicProduct(publicProductRecord());

    expect(dto.variants).toEqual([expect.objectContaining({ id: 'variant_active' })]);
    expect(dto.media).toEqual([expect.objectContaining({ id: 'media_visible', role: 'HERO' })]);
    expect(dto.seo).toEqual({
      metaTitle: 'iPhone 16 Pro | Apple333',
      metaDescription: 'Shop iPhone 16 Pro from Apple333.',
      canonicalUrl: 'https://apple333.example/products/iphone-16-pro',
      noIndex: false,
    });
    expect(dto.seo).not.toHaveProperty('schemaData');
  });

  it('uses bounded legacy SEO fallback values and rejects unsupported canonical protocols', () => {
    const record = publicProductRecord();
    record.seo = {
      metaTitle: null,
      metaDescription: null,
      canonicalUrl: 'javascript:alert(1)',
      noIndex: true,
    };

    const dto = toPublicProduct(record);

    expect(dto.seo).toEqual({
      metaTitle: 'Legacy iPhone title',
      metaDescription: 'Legacy iPhone description',
      canonicalUrl: null,
      noIndex: true,
    });
  });
});
