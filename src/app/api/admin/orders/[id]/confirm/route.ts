import {
  confirmOrderInput,
  orderIdRouteInput,
  type ConfirmOrderInput,
} from "@/modules/orders/validators";
import { jsonBody, withAdminRoute } from "@/server/admin/route";
import { confirmOrder } from "@/server/services/order-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { id } = await params;
  return withAdminRoute<{ id: string; input: ConfirmOrderInput }>({
    permission: "orders.confirm",
    mutation: true,
    parse: async (incoming) => ({
      id: orderIdRouteInput.parse({ id }).id,
      input: await jsonBody(confirmOrderInput)(incoming),
    }),
    handler: ({ actor, input, audit }) =>
      confirmOrder(actor, input.id, input.input, audit),
  })(request);
}
