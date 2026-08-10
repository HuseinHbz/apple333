import { requireActor } from "@/modules/auth/session";
import {
  createPaymentInput,
  orderPaymentRouteInput,
  type CreatePaymentInput,
} from "@/modules/payments/validators";
import { requestId } from "@/server/api/response";
import {
  requestIp,
  requestUserAgent,
} from "@/server/security/request-security";
import { createPaymentForOrder } from "@/server/services/payment-service";
import { correlateStoreRequest } from "@/server/storefront/correlation";
import {
  jsonInput,
  privateStoreResponse,
  runStoreRoute,
} from "@/server/storefront/route";

type RouteContext = Readonly<{
  params: Promise<{ orderNumber: string }>;
}>;

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const correlated = correlateStoreRequest(request);
  return runStoreRoute<CreatePaymentInput>(correlated, {
    rateLimitKey: "store.payment.create",
    mutation: true,
    parse: jsonInput(createPaymentInput),
    handler: async (input) => {
      const actor = await requireActor();
      const { orderNumber } = orderPaymentRouteInput.parse(
        await context.params,
      );
      const ipAddress = requestIp(correlated);
      const userAgent = requestUserAgent(correlated);
      return privateStoreResponse(
        correlated,
        await createPaymentForOrder(actor, orderNumber, input, {
          requestId: requestId(correlated),
          ...(ipAddress ? { ipAddress } : {}),
          ...(userAgent ? { userAgent } : {}),
        }),
        201,
      );
    },
  });
}
