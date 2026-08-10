import { requireActor } from "@/modules/auth/session";
import {
  createOrderFromCartInput,
  orderListQuery,
  type CreateOrderFromCartInput,
  type OrderListQuery,
} from "@/modules/orders/validators";
import { requestId } from "@/server/api/response";
import {
  createStorefrontOrder,
  listCustomerOrders,
} from "@/server/services/order-service";
import { revalidateStorefrontInventory } from "@/server/services/storefront-inventory-cache";
import { correlateStoreRequest } from "@/server/storefront/correlation";
import {
  attachGuestCartCookie,
  resolveGuestCartIdentity,
} from "@/server/storefront/guest-cart";
import {
  jsonInput,
  privateStoreResponse,
  queryInput,
  runStoreRoute,
} from "@/server/storefront/route";
import {
  requestIp,
  requestUserAgent,
} from "@/server/security/request-security";

function auditContext(request: Request) {
  const ipAddress = requestIp(request);
  const userAgent = requestUserAgent(request);
  return {
    requestId: requestId(request),
    ...(ipAddress === undefined ? {} : { ipAddress }),
    ...(userAgent === undefined ? {} : { userAgent }),
  };
}

export async function GET(request: Request): Promise<Response> {
  const correlated = correlateStoreRequest(request);
  return runStoreRoute<OrderListQuery>(correlated, {
    rateLimitKey: "store.orders.list",
    parse: queryInput(orderListQuery),
    handler: async (input) => {
      const actor = await requireActor();
      return privateStoreResponse(
        correlated,
        await listCustomerOrders(actor, input),
      );
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const correlated = correlateStoreRequest(request);
  const identity = resolveGuestCartIdentity(correlated);
  return runStoreRoute<CreateOrderFromCartInput>(correlated, {
    rateLimitKey: "store.orders.create",
    mutation: true,
    parse: jsonInput(createOrderFromCartInput),
    handler: async (input) => {
      const actor = await requireActor();
      const order = await createStorefrontOrder(
        actor,
        identity.tokenHash,
        input,
        auditContext(correlated),
      );
      revalidateStorefrontInventory();
      return attachGuestCartCookie(
        privateStoreResponse(correlated, order, 201),
        identity,
      );
    },
  });
}
