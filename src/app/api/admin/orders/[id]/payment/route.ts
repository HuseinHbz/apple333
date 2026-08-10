import {
  orderIdRouteInput,
  recordOrderPaymentInput,
  type RecordOrderPaymentInput,
} from "@/modules/orders/validators";
import { jsonBody, withAdminRoute } from "@/server/admin/route";
import { recordOrderPayment } from "@/server/services/order-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { id } = await params;
  return withAdminRoute<{ id: string; input: RecordOrderPaymentInput }>({
    permission: "orders.view_financials",
    mutation: true,
    parse: async (incoming) => ({
      id: orderIdRouteInput.parse({ id }).id,
      input: await jsonBody(recordOrderPaymentInput)(incoming),
    }),
    handler: ({ actor, input, audit }) =>
      recordOrderPayment(actor, input.id, input.input, audit),
  })(request);
}
