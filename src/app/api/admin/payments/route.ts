import {
  paymentListQuery,
  type PaymentListQuery,
} from "@/modules/payments/validators";
import { queryParams, withAdminRoute } from "@/server/admin/route";
import { listAdminPayments } from "@/server/services/payment-service";

export const GET = withAdminRoute<PaymentListQuery>({
  permission: "payments.read",
  parse: queryParams(paymentListQuery),
  handler: ({ actor, input }) => listAdminPayments(actor, input),
});
