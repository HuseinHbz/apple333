import {
  paymentIdRouteInput,
  reconcilePaymentInput,
  type ReconcilePaymentInput,
} from "@/modules/payments/validators";
import { jsonBody, withAdminRoute } from "@/server/admin/route";
import { reconcileAdminPayment } from "@/server/services/payment-service";

type RouteContext = Readonly<{ params: Promise<{ id: string }> }>;

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { id } = paymentIdRouteInput.parse(await context.params);
  return withAdminRoute<ReconcilePaymentInput>({
    permission: "payments.reconcile",
    mutation: true,
    parse: jsonBody(reconcilePaymentInput),
    handler: ({ actor, input, audit }) =>
      reconcileAdminPayment(actor, id, input, audit),
  })(request);
}
