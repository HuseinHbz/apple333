import { addCartItemInput, type AddCartItemInput } from '@/modules/cart/validators';
import { addGuestCartItem } from '@/server/services/storefront-cart-service';
import { attachGuestCartCookie, resolveGuestCartIdentity } from '@/server/storefront/guest-cart';
import { jsonInput, privateStoreResponse, runStoreRoute } from '@/server/storefront/route';

export async function POST(request: Request): Promise<Response> {
  const identity = resolveGuestCartIdentity(request);
  return runStoreRoute<AddCartItemInput>(request, {
    rateLimitKey: 'store.cart.add',
    mutation: true,
    parse: jsonInput(addCartItemInput),
    handler: async (input) => attachGuestCartCookie(
      privateStoreResponse(request, await addGuestCartItem(identity.tokenHash, input), 201),
      identity,
    ),
  });
}
