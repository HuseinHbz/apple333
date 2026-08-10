import { paymentIdRouteInput } from "@/modules/payments/validators";
import { withAdminRoute } from "@/server/admin/route";
import { getAdminPayment } from "@/server/services/payment-service";

type RouteContext = Readonly<{ params: Promise<{ id: string }> }>;

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { id } = paymentIdRouteInput.parse(await context.params);
  return withAdminRoute<{ id: string }>({
    permission: "payments.read",
    handler: ({ actor }) => getAdminPayment(actor, id),
  })(request);
}
