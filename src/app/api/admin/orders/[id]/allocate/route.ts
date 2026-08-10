import {
  allocateOrderInput,
  orderIdRouteInput,
  type AllocateOrderInput,
} from "@/modules/orders/validators";
import { jsonBody, withAdminRoute } from "@/server/admin/route";
import { allocateOrder } from "@/server/services/order-service";

type RouteContext = { params: Promise<{ id: string }> };

/** Rebuild an expired or released allocation from immutable order lines. */
export async function POST(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { id } = await params;
  return withAdminRoute<{ id: string; input: AllocateOrderInput }>({
    permission: "orders.allocate",
    mutation: true,
    parse: async (incoming) => ({
      id: orderIdRouteInput.parse({ id }).id,
      input: await jsonBody(allocateOrderInput)(incoming),
    }),
    handler: ({ actor, input, audit }) =>
      allocateOrder(actor, input.id, input.input, audit),
  })(request);
}
