import { unstable_cache } from 'next/cache';

import type { PublicCategoryDto, PublicProductDto } from '@/modules/catalog/types';
import { catalogPageQuery, compareSlugsQuery, productSlugInput, type CatalogPageQuery } from '@/modules/catalog/validators';
import {
  comparePublicProducts,
  getPublicProduct,
  listPublicCategories,
  listPublicProducts,
} from '@/server/services/catalog-service';
import { NotFoundError } from '@/server/errors/app-error';

import type {
  PublicCategoryPageDto,
  PublicProductComparisonDto,
  PublicProductPageDto,
  StorefrontHomeSnapshot,
  StorefrontProductSnapshot,
} from '../types/storefront';

/** Public PIM data is refreshed at most once per minute for server renders. */
export const STOREFRONT_REVALIDATE_SECONDS = 60;

export type StorefrontSearchParams = Readonly<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function optionalValue(value: string | string[] | undefined): string | undefined {
  const normalized = firstValue(value)?.trim();
  return normalized ? normalized : undefined;
}

function catalogCacheKey(query: CatalogPageQuery): string {
  return [
    query.page,
    query.pageSize,
    query.query ?? '',
    query.brand ?? '',
    query.model ?? '',
    query.category ?? '',
    query.color ?? '',
    query.storage ?? '',
    query.minPriceRials?.toString() ?? '',
    query.maxPriceRials?.toString() ?? '',
    query.inStock === undefined ? '' : String(query.inStock),
    query.collection ?? '',
    query.sort,
  ].join('|');
}

function cachedCategories(): Promise<readonly PublicCategoryDto[]> {
  return unstable_cache(
    () => listPublicCategories(),
    ['storefront', 'pim', 'categories'],
    { revalidate: STOREFRONT_REVALIDATE_SECONDS, tags: ['storefront:categories'] },
  )();
}

function cachedCatalogPage(query: CatalogPageQuery): Promise<PublicProductPageDto> {
  const key = catalogCacheKey(query);
  return unstable_cache(
    () => listPublicProducts(query),
    ['storefront', 'pim', 'catalog', key],
    { revalidate: STOREFRONT_REVALIDATE_SECONDS, tags: ['storefront:catalog'] },
  )();
}

function cachedProduct(slug: string): Promise<PublicProductDto> {
  return unstable_cache(
    () => getPublicProduct(slug),
    ['storefront', 'pim', 'product', slug],
    { revalidate: STOREFRONT_REVALIDATE_SECONDS, tags: ['storefront:products', `storefront:product:${slug}`] },
  )();
}

function cachedComparison(slugs: readonly string[]): Promise<readonly PublicProductDto[]> {
  const key = slugs.join('|');
  return unstable_cache(
    () => comparePublicProducts(slugs),
    ['storefront', 'pim', 'compare', key],
    { revalidate: STOREFRONT_REVALIDATE_SECONDS, tags: ['storefront:products'] },
  )();
}

/**
 * Parses only the public Phase 04 catalog query contract. No data model or
 * repository predicate is duplicated in the storefront feature.
 */
export function parseStorefrontCatalogQuery(searchParams: StorefrontSearchParams): CatalogPageQuery {
  const raw = {
    page: optionalValue(searchParams.page),
    pageSize: optionalValue(searchParams.pageSize),
    query: optionalValue(searchParams.query),
    brand: optionalValue(searchParams.brand),
    model: optionalValue(searchParams.model),
    category: optionalValue(searchParams.category),
    color: optionalValue(searchParams.color),
    storage: optionalValue(searchParams.storage),
    minPriceRials: optionalValue(searchParams.minPriceRials),
    maxPriceRials: optionalValue(searchParams.maxPriceRials),
    inStock: optionalValue(searchParams.inStock),
    collection: optionalValue(searchParams.collection),
    sort: optionalValue(searchParams.sort),
  };

  const parsed = catalogPageQuery.safeParse(raw);
  return parsed.success ? parsed.data : catalogPageQuery.parse({});
}

export async function getStorefrontCategories(): Promise<PublicCategoryPageDto> {
  return { items: await cachedCategories() };
}

export async function getStorefrontCatalog(query: CatalogPageQuery): Promise<PublicProductPageDto> {
  return cachedCatalogPage(query);
}

export async function getStorefrontProduct(slug: string): Promise<PublicProductDto | null> {
  const parsed = productSlugInput.safeParse({ slug });
  if (!parsed.success) return null;
  try {
    return await cachedProduct(parsed.data.slug);
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

export async function getStorefrontComparison(slugs: readonly string[]): Promise<PublicProductComparisonDto | null> {
  const parsed = compareSlugsQuery.safeParse({ slugs: slugs.join(',') });
  if (!parsed.success) return null;
  return { items: await cachedComparison(parsed.data.slugs) };
}

export async function getStorefrontHomeSnapshot(): Promise<StorefrontHomeSnapshot> {
  const [categories, featuredProducts, newProducts, saleProducts] = await Promise.all([
    getStorefrontCategories(),
    getStorefrontCatalog(catalogPageQuery.parse({ page: 1, pageSize: 8, collection: 'featured', sort: 'featured' })),
    getStorefrontCatalog(catalogPageQuery.parse({ page: 1, pageSize: 4, collection: 'new', sort: 'newest' })),
    getStorefrontCatalog(catalogPageQuery.parse({ page: 1, pageSize: 4, collection: 'sale', sort: 'featured' })),
  ]);

  return { categories, featuredProducts, newProducts, saleProducts };
}

export async function getStorefrontProductSnapshot(slug: string): Promise<StorefrontProductSnapshot | null> {
  const product = await getStorefrontProduct(slug);
  if (!product) return null;

  const relatedProducts = product.category
    ? await getStorefrontCatalog(catalogPageQuery.parse({
      page: 1,
      pageSize: 4,
      category: product.category.slug,
      sort: 'featured',
    }))
    : null;

  return { product, relatedProducts };
}
