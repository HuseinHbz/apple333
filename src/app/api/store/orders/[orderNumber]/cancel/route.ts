import { requireActor } from "@/modules/auth/session";
import {
  cancelOrderInput,
  orderNumberRouteInput,
  type CancelOrderInput,
} from "@/modules/orders/validators";
import { requestId } from "@/server/api/response";
import { cancelOrder, getCustomerOrder } from "@/server/services/order-service";
import { revalidateStorefrontInventory } from "@/server/services/storefront-inventory-cache";
import { correlateStoreRequest } from "@/server/storefront/correlation";
import {
  jsonInput,
  privateStoreResponse,
  runStoreRoute,
} from "@/server/storefront/route";
import {
  requestIp,
  requestUserAgent,
} from "@/server/security/request-security";

type RouteContext = Readonly<{ params: Promise<{ orderNumber: string }> }>;

function auditContext(request: Request) {
  const ipAddress = requestIp(request);
  const userAgent = requestUserAgent(request);
  return {
    requestId: requestId(request),
    ...(ipAddress === undefined ? {} : { ipAddress }),
    ...(userAgent === undefined ? {} : { userAgent }),
  };
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const correlated = correlateStoreRequest(request);
  return runStoreRoute<CancelOrderInput>(correlated, {
    rateLimitKey: "store.orders.cancel",
    mutation: true,
    parse: jsonInput(cancelOrderInput),
    handler: async (input) => {
      const actor = await requireActor();
      const { orderNumber } = orderNumberRouteInput.parse(await context.params);
      // Resolve by customer-visible order number first; the service enforces
      // ownership before exposing the internal primary key to this command.
      const order = await getCustomerOrder(actor, orderNumber);
      const cancelled = await cancelOrder(
        actor,
        order.id,
        input,
        auditContext(correlated),
      );
      revalidateStorefrontInventory();
      return privateStoreResponse(correlated, cancelled);
    },
  });
}
