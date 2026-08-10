import {
  createOrderNoteInput,
  orderIdRouteInput,
  type CreateOrderNoteInput,
} from "@/modules/orders/validators";
import { jsonBody, withAdminRoute } from "@/server/admin/route";
import { addOrderNote } from "@/server/services/order-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { id } = await params;
  return withAdminRoute<{ id: string; input: CreateOrderNoteInput }>({
    // The service differentiates customer-visible and internal-note rights.
    permission: "orders.read",
    mutation: true,
    parse: async (incoming) => ({
      id: orderIdRouteInput.parse({ id }).id,
      input: await jsonBody(createOrderNoteInput)(incoming),
    }),
    handler: ({ actor, input, audit }) =>
      addOrderNote(actor, input.id, input.input, audit),
  })(request);
}
