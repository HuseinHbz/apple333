import {
  createRefundInput,
  paymentIdRouteInput,
  type CreateRefundInput,
} from "@/modules/payments/validators";
import { jsonBody, withAdminRoute } from "@/server/admin/route";
import { createRefund } from "@/server/services/payment-service";

type RouteContext = Readonly<{ params: Promise<{ id: string }> }>;

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { id } = paymentIdRouteInput.parse(await context.params);
  return withAdminRoute<CreateRefundInput>({
    permission: "payments.refund",
    mutation: true,
    parse: jsonBody(createRefundInput),
    handler: ({ actor, input, audit }) => createRefund(actor, id, input, audit),
  })(request);
}
