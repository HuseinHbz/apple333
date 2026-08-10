import {
  createOrderFulfillmentInput,
  orderIdRouteInput,
  type CreateOrderFulfillmentInput,
} from "@/modules/orders/validators";
import { jsonBody, withAdminRoute } from "@/server/admin/route";
import { createOrderFulfillment } from "@/server/services/order-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { id } = await params;
  return withAdminRoute<{ id: string; input: CreateOrderFulfillmentInput }>({
    permission: "orders.fulfill",
    mutation: true,
    parse: async (incoming) => ({
      id: orderIdRouteInput.parse({ id }).id,
      input: await jsonBody(createOrderFulfillmentInput)(incoming),
    }),
    handler: ({ actor, input, audit }) =>
      createOrderFulfillment(actor, input.id, input.input, audit),
  })(request);
}
