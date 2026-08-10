import { requireActor } from "@/modules/auth/session";
import { paymentIdRouteInput } from "@/modules/payments/validators";
import { getCustomerPayment } from "@/server/services/payment-service";
import { correlateStoreRequest } from "@/server/storefront/correlation";
import { privateStoreResponse, runStoreRoute } from "@/server/storefront/route";

type RouteContext = Readonly<{ params: Promise<{ id: string }> }>;

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const correlated = correlateStoreRequest(request);
  return runStoreRoute(correlated, {
    rateLimitKey: "store.payment.detail",
    handler: async () => {
      const actor = await requireActor();
      const { id } = paymentIdRouteInput.parse(await context.params);
      return privateStoreResponse(
        correlated,
        await getCustomerPayment(actor, id),
      );
    },
  });
}
