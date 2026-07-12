import { productSlugInput } from '@/modules/catalog/validators';
import { getPublicProduct } from '@/server/services/catalog-service';
import { publicStoreResponse, runStoreRoute } from '@/server/storefront/route';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  return runStoreRoute(request, {
    rateLimitKey: 'store.product',
    parse: async () => productSlugInput.parse(await params),
    handler: async (input) => publicStoreResponse(request, await getPublicProduct(input.slug)),
  });
}
