import { catalogPageQuery, type CatalogPageQuery } from '@/modules/catalog/validators';
import { listPublicProducts } from '@/server/services/catalog-service';
import { publicStoreResponse, queryInput, runStoreRoute } from '@/server/storefront/route';

/**
 * Public catalog compatibility endpoint.
 *
 * The storefront originally shipped under `/api/store/products`.  Keep that
 * route as the canonical storefront surface while offering the stable public
 * `/api/products` alias expected by external consumers.
 */
export async function GET(request: Request): Promise<Response> {
  return runStoreRoute<CatalogPageQuery>(request, {
    rateLimitKey: 'public.products',
    parse: queryInput(catalogPageQuery),
    handler: async (input) => publicStoreResponse(request, await listPublicProducts(input)),
  });
}
