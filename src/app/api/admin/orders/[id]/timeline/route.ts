import { orderIdRouteInput } from "@/modules/orders/validators";
import { withAdminRoute } from "@/server/admin/route";
import { getAdminOrder } from "@/server/services/order-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { id } = await params;
  return withAdminRoute<{ id: string }>({
    permission: "orders.read",
    parse: async () => orderIdRouteInput.parse({ id }),
    handler: async ({ actor, input }) => ({
      timeline: (await getAdminOrder(actor, input.id)).timeline,
    }),
  })(request);
}
