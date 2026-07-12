import { describe, expect, it } from 'vitest';

import {
  createProductInput,
  productImportPreviewInput,
  productListQuery,
  productSpecificationInput,
  productVariantInput,
  updateProductInput,
} from '@/modules/pim/validators';

const CATEGORY_ID = 'ckz8x8x8x000001l4h3e5f6g7';
const ATTRIBUTE_ID = 'cm1a2b3c4d5e6f7g8h9i0j1k2';

describe('PIM validators', () => {
  it('normalizes bounded product-list filters and applies safe defaults', () => {
    const query = productListQuery.parse({
      page: '2',
      pageSize: '50',
      query: '  iPhone 16  ',
      status: 'PUBLISHED',
      includeArchived: 'false',
    });

    expect(query).toEqual({
      page: 2,
      pageSize: 50,
      query: 'iPhone 16',
      status: 'PUBLISHED',
      includeArchived: false,
    });
    expect(() => productListQuery.parse({ page: '0' })).toThrow();
    expect(() => productListQuery.parse({ includeArchived: 'yes' })).toThrow();
  });

  it('normalizes SKU codes, preserves integer rial prices, and enforces price ordering', () => {
    const variant = productVariantInput.parse({
      skuCode: ' iphone-16_pro-256 ',
      priceRials: '1000000000',
      compareAtPriceRials: '1200000000',
    });

    expect(variant).toMatchObject({
      skuCode: 'IPHONE-16_PRO-256',
      priceRials: 1_000_000_000n,
      compareAtPriceRials: 1_200_000_000n,
      status: 'ACTIVE',
      isActive: true,
    });
    expect(() => productVariantInput.parse({
      skuCode: 'IPHONE-16',
      priceRials: '1000',
      compareAtPriceRials: '999',
    })).toThrow();
  });

  it('requires a variant SKU only for variant-scoped specifications', () => {
    expect(productSpecificationInput.parse({
      attributeId: ATTRIBUTE_ID,
      scope: 'VARIANT',
      variantSkuCode: 'iphone-16-pro-256',
      displayValue: '256 GB',
    })).toMatchObject({
      scope: 'VARIANT',
      variantSkuCode: 'IPHONE-16-PRO-256',
    });

    expect(() => productSpecificationInput.parse({
      attributeId: ATTRIBUTE_ID,
      scope: 'VARIANT',
      displayValue: '256 GB',
    })).toThrow();
    expect(() => productSpecificationInput.parse({
      attributeId: ATTRIBUTE_ID,
      scope: 'PRODUCT',
      variantSkuCode: 'IPHONE-16-PRO-256',
      displayValue: '6.3 inches',
    })).toThrow();
  });

  it('rejects duplicate product SKUs and unexpected product properties', () => {
    const baseProduct = {
      categoryId: CATEGORY_ID,
      slug: 'iphone-16-pro',
      name: 'iPhone 16 Pro',
      variants: [
        { skuCode: 'IPHONE-16-PRO-128', priceRials: '1000' },
        { skuCode: 'IPHONE-16-PRO-128', priceRials: '1100' },
      ],
    };

    expect(() => createProductInput.parse(baseProduct)).toThrow();
    expect(() => createProductInput.parse({
      ...baseProduct,
      variants: [{ skuCode: 'IPHONE-16-PRO-128', priceRials: '1000' }],
      internalOnly: true,
    })).toThrow();
  });

  it('requires an optimistic-lock version and at least one product change on updates', () => {
    expect(updateProductInput.parse({ version: 3, name: 'iPhone 16 Pro Max' })).toEqual({
      version: 3,
      name: 'iPhone 16 Pro Max',
    });
    expect(() => updateProductInput.parse({ version: 0, name: 'iPhone 16 Pro Max' })).toThrow();
    expect(() => updateProductInput.parse({ version: 3 })).toThrow();
  });

  it('accepts only bounded, checksum-safe staged import previews', () => {
    const preview = productImportPreviewInput.parse({
      format: 'CSV',
      originalFileName: 'products.csv',
      sourceChecksum: 'a'.repeat(64),
      rows: [{ rowNumber: 1, data: { sku: 'IPHONE-16-PRO-128', priceRials: '1000' } }],
    });

    expect(preview.rows).toHaveLength(1);
    expect(() => productImportPreviewInput.parse({
      ...preview,
      sourceChecksum: 'not-a-sha256',
    })).toThrow();
    expect(() => productImportPreviewInput.parse({
      ...preview,
      rows: [],
    })).toThrow();
  });
});
