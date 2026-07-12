import { cartVariantInput, updateCartItemInput } from '@/modules/cart/validators';
import { removeGuestCartItem, updateGuestCartItem } from '@/server/services/storefront-cart-service';
import { attachGuestCartCookie, resolveGuestCartIdentity } from '@/server/storefront/guest-cart';
import { privateStoreResponse, runStoreRoute } from '@/server/storefront/route';

type RouteContext = { params: Promise<{ variantId: string }> };

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  const identity = resolveGuestCartIdentity(request);
  return runStoreRoute(request, {
    rateLimitKey: 'store.cart.update',
    mutation: true,
    parse: async () => ({
      variantId: cartVariantInput.parse(await params).variantId,
      ...updateCartItemInput.parse(await request.json()),
    }),
    handler: async (input) => attachGuestCartCookie(
      privateStoreResponse(request, await updateGuestCartItem(identity.tokenHash, input.variantId, { quantity: input.quantity })),
      identity,
    ),
  });
}

export async function DELETE(request: Request, { params }: RouteContext): Promise<Response> {
  const identity = resolveGuestCartIdentity(request);
  return runStoreRoute(request, {
    rateLimitKey: 'store.cart.remove',
    mutation: true,
    parse: async () => cartVariantInput.parse(await params),
    handler: async (input) => attachGuestCartCookie(
      privateStoreResponse(request, await removeGuestCartItem(identity.tokenHash, input.variantId)),
      identity,
    ),
  });
}
