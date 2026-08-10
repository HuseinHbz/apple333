import {
  cancelOrderInput,
  orderIdRouteInput,
  type CancelOrderInput,
} from "@/modules/orders/validators";
import { jsonBody, withAdminRoute } from "@/server/admin/route";
import { cancelOrder } from "@/server/services/order-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { id } = await params;
  return withAdminRoute<{ id: string; input: CancelOrderInput }>({
    // The service selects orders.cancel or orders.cancel_after_payment from
    // the persisted payment state, so the wrapper retains only read access.
    permission: "orders.read",
    mutation: true,
    parse: async (incoming) => ({
      id: orderIdRouteInput.parse({ id }).id,
      input: await jsonBody(cancelOrderInput)(incoming),
    }),
    handler: ({ actor, input, audit }) =>
      cancelOrder(actor, input.id, input.input, audit),
  })(request);
}
