import type { PublicProductDto } from '@/modules/catalog/types';

import { storefrontUrl } from '../services/metadata';

type JsonLd = Readonly<Record<string, unknown>>;

function serializeJsonLd(value: JsonLd): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function StructuredData({ data }: { data: JsonLd | readonly JsonLd[] }) {
  const normalized = Array.isArray(data) ? data : [data];

  return (
    <script
      type="application/ld+json"
      // JSON is built solely from the typed public PIM projection and is escaped
      // before insertion so product content cannot close the script element.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd({ '@context': 'https://schema.org', '@graph': normalized }) }}
    />
  );
}

export function organizationSchema(): JsonLd {
  return {
    '@type': 'Organization',
    name: 'Apple333',
    url: storefrontUrl('/'),
    logo: storefrontUrl('/icon.png'),
  };
}

export function productSchemas(product: PublicProductDto): readonly JsonLd[] {
  const canonical = storefrontUrl(`/products/${encodeURIComponent(product.slug)}`);
  const images = product.media
    .filter((media) => media.role !== 'VIDEO')
    .map((media) => storefrontUrl(media.url));
  const offer: JsonLd = {
    '@type': 'Offer',
    priceCurrency: 'IRR',
    price: product.startingPriceRials,
    availability: product.availability === 'IN_STOCK' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    url: canonical,
  };

  const productSchema: JsonLd = {
    '@type': 'Product',
    name: product.name,
    sku: product.variants[0]?.sku ?? product.id,
    brand: { '@type': 'Brand', name: product.brand },
    category: product.category?.name,
    description: product.summary ?? product.description ?? undefined,
    image: images.length > 0 ? images : undefined,
    offers: offer,
  };

  const breadcrumbSchema: JsonLd = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'خانه', item: storefrontUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'محصولات', item: storefrontUrl('/products') },
      ...(product.category ? [{ '@type': 'ListItem', position: 3, name: product.category.name, item: storefrontUrl(`/products?category=${encodeURIComponent(product.category.slug)}`) }] : []),
      { '@type': 'ListItem', position: product.category ? 4 : 3, name: product.name, item: canonical },
    ],
  };

  // Verified customer reviews are not in the public PIM projection yet. A
  // Review schema must therefore not be emitted with invented ratings.
  return [productSchema, breadcrumbSchema];
}
