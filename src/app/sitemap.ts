import type { MetadataRoute } from 'next';

import { storefrontUrl } from '@/features/storefront/services/metadata';
import { listPublicCategories, listPublicSitemapEntries } from '@/server/services/catalog-service';

const SITEMAP_URL_LIMIT = 50_000;
const SITEMAP_SHARD_COUNT = 20;

/**
 * Product sitemaps are sharded at the standard 50k URL boundary. They use a
 * compact, public-only PIM projection rather than loading product details.
 */
export async function generateSitemaps(): Promise<Array<{ id: number }>> {
  // `generateSitemaps` runs during `next build`. Keep it database-independent
  // so a build never needs production credentials; each runtime shard can hold
  // 50k public products (1m products across the configured shard envelope).
  return Array.from({ length: SITEMAP_SHARD_COUNT }, (_, id) => ({ id }));
}

export default async function sitemap({ id = 0 }: { id?: number }): Promise<MetadataRoute.Sitemap> {
  const [productEntries, categories] = await Promise.all([
    listPublicSitemapEntries({ skip: id * SITEMAP_URL_LIMIT, take: SITEMAP_URL_LIMIT }),
    id === 0 ? listPublicCategories() : Promise.resolve([]),
  ]);
  const coreEntries: MetadataRoute.Sitemap = id === 0
    ? [
      { url: storefrontUrl('/'), lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
      { url: storefrontUrl('/products'), lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
      { url: storefrontUrl('/compare'), lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
      ...categories.map((category) => ({
        url: storefrontUrl(`/categories/${encodeURIComponent(category.slug)}`),
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
    ]
    : [];

  return [
    ...coreEntries,
    ...productEntries
      .filter((product) => !product.noIndex)
      .map((product) => ({
        url: storefrontUrl(`/products/${encodeURIComponent(product.slug)}`),
        lastModified: product.lastModified,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
  ];
}

// Sitemap data must be generated against the runtime PIM database, not during
// an artifact-only build where no database connection is intentionally present.
export const dynamic = 'force-dynamic';
