import { CatalogBrowser } from '@/components/store/catalog-browser';
import { catalogPageQuery } from '@/modules/catalog/validators';

import { storefrontCatalogApiPath } from '../services/catalog-url';
import { getStorefrontCatalog, getStorefrontCategories, parseStorefrontCatalogQuery, type StorefrontSearchParams } from '../services/server-catalog';

function stringValue(value: string | undefined): string {
  return value ?? '';
}

/**
 * Renders the catalog with a PIM-derived server snapshot, then leaves filtering
 * and pagination as a client island backed by the same public API contract.
 */
export async function CatalogContainer({ searchParams }: { searchParams: StorefrontSearchParams }) {
  const parsed = parseStorefrontCatalogQuery(searchParams);
  const query = catalogPageQuery.parse({ ...parsed, pageSize: 24 });
  const filters = {
    query: stringValue(query.query),
    brand: stringValue(query.brand),
    model: stringValue(query.model),
    category: stringValue(query.category),
    color: stringValue(query.color),
    storage: stringValue(query.storage),
    minPriceRials: query.minPriceRials?.toString() ?? '',
    maxPriceRials: query.maxPriceRials?.toString() ?? '',
    inStock: query.inStock ?? false,
    sort: query.sort,
    page: query.page,
  };
  const productsUrl = storefrontCatalogApiPath(filters);

  try {
    const [categories, products] = await Promise.all([
      getStorefrontCategories(),
      getStorefrontCatalog(query),
    ]);
    return <CatalogBrowser initialCategory={filters.category} initialData={{ categories, products, productsUrl, filters }} />;
  } catch {
    return <CatalogBrowser initialCategory={filters.category} />;
  }
}
