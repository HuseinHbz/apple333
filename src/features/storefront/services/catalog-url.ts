import { normalizePersianSearchTerm } from '@/features/storefront/services/persian-search';

export type StorefrontCatalogSort = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'name';

export type StorefrontCatalogUrlInput = Readonly<{
  query?: string;
  brand?: string;
  model?: string;
  category?: string;
  color?: string;
  storage?: string;
  minPriceRials?: string;
  maxPriceRials?: string;
  inStock?: boolean;
  sort?: StorefrontCatalogSort;
  page?: number;
  pageSize?: number;
}>;

/**
 * Produces the canonical public PIM catalog URL from browser state. It keeps
 * filters in the URL for shareability and never exposes a direct DB query.
 */
export function storefrontCatalogApiPath(input: StorefrontCatalogUrlInput = {}): string {
  const search = new URLSearchParams({
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? 24),
    sort: input.sort ?? 'featured',
  });
  const query = input.query ? normalizePersianSearchTerm(input.query) : '';

  if (query) search.set('query', query);
  if (input.brand) search.set('brand', input.brand);
  if (input.model) search.set('model', input.model);
  if (input.category) search.set('category', input.category);
  if (input.color) search.set('color', input.color);
  if (input.storage) search.set('storage', input.storage);
  if (input.minPriceRials && /^\d+$/.test(input.minPriceRials.trim())) search.set('minPriceRials', input.minPriceRials.trim());
  if (input.maxPriceRials && /^\d+$/.test(input.maxPriceRials.trim())) search.set('maxPriceRials', input.maxPriceRials.trim());
  if (input.inStock) search.set('inStock', 'true');

  return `/api/store/products?${search.toString()}`;
}
