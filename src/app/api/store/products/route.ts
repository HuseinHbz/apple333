import { catalogPageQuery, type CatalogPageQuery } from '@/modules/catalog/validators';
import { listPublicProducts } from '@/server/services/catalog-service';
import { publicStoreResponse, queryInput, runStoreRoute } from '@/server/storefront/route';

export async function GET(request: Request): Promise<Response> {
  return runStoreRoute<CatalogPageQuery>(request, {
    rateLimitKey: 'store.products',
    parse: queryInput(catalogPageQuery),
    handler: async (input) => publicStoreResponse(request, await listPublicProducts(input)),
  });
}
