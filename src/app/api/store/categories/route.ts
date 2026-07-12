import { listPublicCategories } from '@/server/services/catalog-service';
import { publicStoreResponse, runStoreRoute } from '@/server/storefront/route';

export async function GET(request: Request): Promise<Response> {
  return runStoreRoute(request, {
    rateLimitKey: 'store.categories',
    handler: async () => publicStoreResponse(request, { items: await listPublicCategories() }),
  });
}
