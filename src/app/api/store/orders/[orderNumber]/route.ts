import { requireActor } from "@/modules/auth/session";
import { orderNumberRouteInput } from "@/modules/orders/validators";
import { getCustomerOrder } from "@/server/services/order-service";
import { correlateStoreRequest } from "@/server/storefront/correlation";
import { privateStoreResponse, runStoreRoute } from "@/server/storefront/route";

type RouteContext = Readonly<{ params: Promise<{ orderNumber: string }> }>;

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const correlated = correlateStoreRequest(request);
  return runStoreRoute(correlated, {
    rateLimitKey: "store.orders.detail",
    handler: async () => {
      const actor = await requireActor();
      const { orderNumber } = orderNumberRouteInput.parse(await context.params);
      return privateStoreResponse(
        correlated,
        await getCustomerOrder(actor, orderNumber),
      );
    },
  });
}
