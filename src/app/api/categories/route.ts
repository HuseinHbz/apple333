import { listPublicCategories } from '@/server/services/catalog-service';
import { publicStoreResponse, runStoreRoute } from '@/server/storefront/route';

/** Public category compatibility endpoint for `/api/categories`. */
export async function GET(request: Request): Promise<Response> {
  return runStoreRoute(request, {
    rateLimitKey: 'public.categories',
    handler: async () => publicStoreResponse(request, { items: await listPublicCategories() }),
  });
}
