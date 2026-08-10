import {
  createAdminOrderInput,
  orderListQuery,
  type CreateAdminOrderInput,
  type OrderListQuery,
} from "@/modules/orders/validators";
import { jsonBody, queryParams, withAdminRoute } from "@/server/admin/route";
import {
  createAdminOrder,
  listAdminOrders,
} from "@/server/services/order-service";

export const GET = withAdminRoute<OrderListQuery>({
  permission: "orders.read",
  parse: queryParams(orderListQuery),
  handler: ({ actor, input, audit }) => listAdminOrders(actor, input, audit),
});

export const POST = withAdminRoute<CreateAdminOrderInput>({
  permission: "orders.create_admin",
  mutation: true,
  parse: jsonBody(createAdminOrderInput),
  handler: ({ actor, input, audit }) => createAdminOrder(actor, input, audit),
  status: 201,
});
