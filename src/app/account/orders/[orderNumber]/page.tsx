import { redirect } from "next/navigation";

import { CustomerOrderDetail } from "@/components/orders/customer-order-detail";
import { OrderPaymentSummary } from "@/components/payments/order-payment-summary";
import { currentActor } from "@/modules/auth/session";
import { orderNumberRouteInput } from "@/modules/orders/validators";
import { isPaymentSimulatorRuntimeAllowed } from "@/modules/payments/runtime-policy";
import type { PaymentDto } from "@/modules/payments/types";
import {
  PaymentServiceError,
  getOrderPayment,
} from "@/server/services/payment-service";

export const metadata = { title: "پیگیری سفارش | Apple333" };

export default async function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/account/login?callbackUrl=/account/orders");
  if (!actor.permissions.has("orders.read_own")) redirect("/account");
  const { orderNumber } = orderNumberRouteInput.parse(await params);
  let payment: PaymentDto | null = null;
  try {
    payment = await getOrderPayment(actor, orderNumber);
  } catch (error) {
    if (
      !(error instanceof PaymentServiceError) ||
      error.code !== "PAYMENT_NOT_FOUND"
    ) {
      throw error;
    }
  }
  return (
    <>
      <CustomerOrderDetail orderNumber={orderNumber} />
      <OrderPaymentSummary
        orderNumber={orderNumber}
        payment={payment}
        providerAvailable={isPaymentSimulatorRuntimeAllowed()}
      />
    </>
  );
}
