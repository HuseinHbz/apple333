import { checkoutQuoteInput, type CheckoutQuoteInput } from '@/modules/cart/validators';
import { quoteGuestCart } from '@/server/services/storefront-cart-service';
import { attachGuestCartCookie, resolveGuestCartIdentity } from '@/server/storefront/guest-cart';
import { jsonInput, privateStoreResponse, runStoreRoute } from '@/server/storefront/route';

export async function POST(request: Request): Promise<Response> {
  const identity = resolveGuestCartIdentity(request);
  return runStoreRoute<CheckoutQuoteInput>(request, {
    rateLimitKey: 'store.checkout.quote',
    mutation: true,
    parse: jsonInput(checkoutQuoteInput),
    handler: async (input) => attachGuestCartCookie(
      privateStoreResponse(request, await quoteGuestCart(identity.tokenHash, input)),
      identity,
    ),
  });
}
