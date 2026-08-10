import { describe, expect, it } from 'vitest';

import { productSchemas } from '@/features/storefront/components/structured-data';
import { productMetadata, storefrontUrl } from '@/features/storefront/services/metadata';
import type { PublicProductDto } from '@/modules/catalog/types';

const product = {
  id: 'product_1',
  slug: 'iphone-16-pro',
  name: 'iPhone 16 Pro',
  brand: 'Apple',
  summary: 'A professional iPhone.',
  category: { slug: 'iphone', name: 'iPhone' },
  heroMediaUrl: '/api/store/media/product_1/media_1',
  startingPriceRials: '1230000000',
  compareAtPriceRials: null,
  availability: 'IN_STOCK',
  isNew: true,
  isOnSale: false,
  description: 'Product description',
  specifications: [{ key: 'Display', value: '6.3 inch' }],
  media: [{ id: 'media_1', role: 'HERO', altText: 'iPhone front', url: '/api/store/media/product_1/media_1' }],
  variants: [{
    id: 'variant_1', sku: 'IPHONE-16-PRO-128', title: '128GB', color: 'Black', storage: '128GB', region: null, warranty: null,
    priceRials: '1230000000', compareAtPriceRials: null, availability: 'IN_STOCK', branches: [],
  }],
  seo: { metaTitle: 'Buy iPhone 16 Pro', metaDescription: 'Official product details.', canonicalUrl: null, noIndex: false },
} satisfies PublicProductDto;

describe('storefront SEO projection', () => {
  it('uses the local product path as the canonical URL when PIM does not provide one', () => {
    const metadata = productMetadata(product);
    expect(metadata.alternates).toMatchObject({ canonical: storefrontUrl('/products/iphone-16-pro') });
  });

  it('does not trust a cross-origin canonical URL from product content', () => {
    const metadata = productMetadata({ ...product, seo: { ...product.seo, canonicalUrl: 'https://untrusted.example/product' } });
    expect(metadata.alternates).toMatchObject({ canonical: storefrontUrl('/products/iphone-16-pro') });
  });

  it('makes no-index products unavailable to search crawlers', () => {
    const metadata = productMetadata({ ...product, seo: { ...product.seo, noIndex: true } });
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('creates Product, Offer, and Breadcrumb schemas from the public PIM DTO', () => {
    const schemas = productSchemas(product) as readonly Record<string, unknown>[];
    const productSchema = schemas.find((schema) => schema['@type'] === 'Product');
    const breadcrumbSchema = schemas.find((schema) => schema['@type'] === 'BreadcrumbList');

    expect(productSchema).toMatchObject({
      name: 'iPhone 16 Pro',
      brand: { name: 'Apple' },
      offers: { price: '1230000000', priceCurrency: 'IRR' },
    });
    expect(breadcrumbSchema).toMatchObject({ '@type': 'BreadcrumbList' });
  });

  it('does not emit an invented review or aggregate rating schema', () => {
    const serialized = JSON.stringify(productSchemas(product));
    expect(serialized).not.toContain('AggregateRating');
    expect(serialized).not.toContain('Review');
  });
});
