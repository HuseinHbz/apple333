import { NotFoundError } from '@/server/errors/app-error';
import type {
  PublicCategoryDto,
  PublicProductCardDto,
  PublicProductDto,
  PublicProductSeoDto,
  PublicProductVariantDto,
  ProductAvailability,
} from '@/modules/catalog/types';
import type { CatalogPageQuery } from '@/modules/catalog/validators';
import { catalogRepository, type PublicProductRecord, type PublicVariantRecord } from '@/server/repositories/catalog-repository';

function price(value: bigint): string {
  return value.toString();
}

function availability(variant: PublicVariantRecord): ProductAvailability {
  return variant.inventory.some((entry) => entry.branch.isActive && entry.onHand > entry.reserved) ? 'IN_STOCK' : 'OUT_OF_STOCK';
}

function publicMediaUrl(productId: string, mediaId: string): string {
  return `/api/store/media/${encodeURIComponent(productId)}/${encodeURIComponent(mediaId)}`;
}

function firstMedia(product: PublicProductRecord) {
  return product.media.find((entry) => isPublicMedia(entry) && entry.role === 'HERO')
    ?? product.media.find(isPublicMedia);
}

function activeVariants(product: PublicProductRecord): PublicVariantRecord[] {
  return product.variants.filter((variant) => (
    variant.isActive
    && variant.deletedAt === null
    && variant.skuRecord?.status === 'ACTIVE'
    && variant.skuRecord.deletedAt === null
  ));
}

function startingVariant(product: PublicProductRecord): PublicVariantRecord {
  const variants = [...activeVariants(product)].sort((left, right) => (left.priceRials < right.priceRials ? -1 : left.priceRials > right.priceRials ? 1 : left.sortOrder - right.sortOrder));
  const variant = variants[0];
  if (!variant) throw new NotFoundError();
  return variant;
}

function category(product: PublicProductRecord): PublicProductCardDto['category'] {
  if (!product.category || !product.category.isActive || product.category.deletedAt !== null) return null;
  return { slug: product.category.slug, name: product.category.name };
}

function isPublicMedia(entry: PublicProductRecord['media'][number]): boolean {
  return entry.media.deletedAt === null
    && (!entry.variant || (entry.variant.isActive && entry.variant.deletedAt === null));
}

function safeSeoText(value: string | null, maxLength: number): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function safeCanonicalUrl(value: string | null): string | null {
  const normalized = safeSeoText(value, 2_048);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function seo(product: PublicProductRecord): PublicProductSeoDto {
  return {
    metaTitle: safeSeoText(product.seo?.metaTitle ?? product.seoTitle, 70),
    metaDescription: safeSeoText(product.seo?.metaDescription ?? product.seoDescription, 170),
    canonicalUrl: safeCanonicalUrl(product.seo?.canonicalUrl ?? null),
    noIndex: product.seo?.noIndex ?? false,
  };
}

function asCard(product: PublicProductRecord): PublicProductCardDto {
  const variant = startingVariant(product);
  const hero = firstMedia(product);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    summary: product.summary,
    category: category(product),
    heroMediaUrl: hero ? publicMediaUrl(product.id, hero.mediaId) : null,
    startingPriceRials: price(variant.priceRials),
    compareAtPriceRials: variant.compareAtPriceRials ? price(variant.compareAtPriceRials) : null,
    availability: activeVariants(product).some((entry) => availability(entry) === 'IN_STOCK') ? 'IN_STOCK' : 'OUT_OF_STOCK',
    isNew: product.isNew,
    isOnSale: product.isOnSale,
  };
}

function asVariant(variant: PublicVariantRecord): PublicProductVariantDto {
  return {
    id: variant.id,
    sku: variant.sku,
    title: variant.title,
    color: variant.color,
    storage: variant.storage,
    region: variant.region,
    warranty: variant.warranty,
    priceRials: price(variant.priceRials),
    compareAtPriceRials: variant.compareAtPriceRials ? price(variant.compareAtPriceRials) : null,
    availability: availability(variant),
    branches: variant.inventory
      .filter((entry) => entry.branch.isActive && entry.branch.isPickupEnabled)
      .map((entry) => ({ id: entry.branch.id, name: entry.branch.name, city: entry.branch.city, available: Math.max(entry.onHand - entry.reserved, 0) })),
  };
}

function stringSpecifications(value: unknown): PublicProductDto['specifications'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, item]) => {
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') return [{ key, value: String(item) }];
      return [];
    })
    .slice(0, 40);
}

export function toPublicProductCard(product: PublicProductRecord): PublicProductCardDto {
  return asCard(product);
}

export function toPublicProduct(product: PublicProductRecord): PublicProductDto {
  const card = asCard(product);
  return {
    ...card,
    description: product.description,
    specifications: stringSpecifications(product.specifications),
    media: product.media
      .filter(isPublicMedia)
      .map((entry) => ({ id: entry.mediaId, role: entry.role, altText: entry.altText, url: publicMediaUrl(product.id, entry.mediaId) })),
    variants: activeVariants(product).map(asVariant),
    seo: seo(product),
  };
}

function comparePrices(left: string, right: string): number {
  const leftPrice = BigInt(left);
  const rightPrice = BigInt(right);
  return leftPrice < rightPrice ? -1 : leftPrice > rightPrice ? 1 : 0;
}

function sortCards(cards: PublicProductCardDto[], sort: CatalogPageQuery['sort']): PublicProductCardDto[] {
  if (sort === 'price-asc') return [...cards].sort((left, right) => comparePrices(left.startingPriceRials, right.startingPriceRials));
  if (sort === 'price-desc') return [...cards].sort((left, right) => comparePrices(right.startingPriceRials, left.startingPriceRials));
  return cards;
}

export async function listPublicCategories(): Promise<readonly PublicCategoryDto[]> {
  return catalogRepository.listCategories();
}

export async function listPublicProducts(query: CatalogPageQuery) {
  const result = await catalogRepository.findPublicPage(query);
  let items = result.items.map(toPublicProductCard);
  items = sortCards(items, query.sort);
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total: result.total,
    totalPages: Math.max(1, Math.ceil(result.total / query.pageSize)),
  };
}

export async function getPublicProduct(slug: string): Promise<PublicProductDto> {
  const product = await catalogRepository.findPublicBySlug(slug);
  if (!product) throw new NotFoundError();
  return toPublicProduct(product);
}

export async function comparePublicProducts(slugs: readonly string[]): Promise<readonly PublicProductDto[]> {
  const records = await catalogRepository.findPublicBySlugs(slugs);
  const mapped = new Map(records.map((product) => [product.slug, toPublicProduct(product)]));
  return slugs.flatMap((slug) => {
    const product = mapped.get(slug);
    return product ? [product] : [];
  });
}
