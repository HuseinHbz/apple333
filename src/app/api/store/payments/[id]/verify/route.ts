import { requireActor } from "@/modules/auth/session";
import {
  paymentIdRouteInput,
  verifyPaymentInput,
  type VerifyPaymentInput,
} from "@/modules/payments/validators";
import { requestId } from "@/server/api/response";
import {
  requestIp,
  requestUserAgent,
} from "@/server/security/request-security";
import { verifyPayment } from "@/server/services/payment-service";
import { correlateStoreRequest } from "@/server/storefront/correlation";
import {
  jsonInput,
  privateStoreResponse,
  runStoreRoute,
} from "@/server/storefront/route";

type RouteContext = Readonly<{ params: Promise<{ id: string }> }>;

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const correlated = correlateStoreRequest(request);
  return runStoreRoute<VerifyPaymentInput>(correlated, {
    rateLimitKey: "store.payment.verify",
    mutation: true,
    parse: jsonInput(verifyPaymentInput),
    handler: async (input) => {
      const actor = await requireActor();
      const { id } = paymentIdRouteInput.parse(await context.params);
      const ipAddress = requestIp(correlated);
      const userAgent = requestUserAgent(correlated);
      return privateStoreResponse(
        correlated,
        await verifyPayment(actor, id, input, {
          requestId: requestId(correlated),
          ...(ipAddress ? { ipAddress } : {}),
          ...(userAgent ? { userAgent } : {}),
        }),
      );
    },
  });
}
