import { getGuestCart } from '@/server/services/storefront-cart-service';
import { attachGuestCartCookie, resolveGuestCartIdentity } from '@/server/storefront/guest-cart';
import { privateStoreResponse, runStoreRoute } from '@/server/storefront/route';

export async function GET(request: Request): Promise<Response> {
  const identity = resolveGuestCartIdentity(request);
  return runStoreRoute(request, {
    rateLimitKey: 'store.cart.read',
    handler: async () => attachGuestCartCookie(
      privateStoreResponse(request, await getGuestCart(identity.tokenHash)),
      identity,
    ),
  });
}
