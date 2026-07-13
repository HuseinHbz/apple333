import { compareSlugsQuery, type CompareSlugsQuery } from '@/modules/catalog/validators';
import { comparePublicProducts } from '@/server/services/catalog-service';
import { publicStoreResponse, queryInput, runStoreRoute } from '@/server/storefront/route';

export async function GET(request: Request): Promise<Response> {
  return runStoreRoute<CompareSlugsQuery>(request, {
    rateLimitKey: 'store.products.compare',
    parse: queryInput(compareSlugsQuery),
    handler: async (input) => publicStoreResponse(request, { items: await comparePublicProducts(input.slugs) }),
  });
}
