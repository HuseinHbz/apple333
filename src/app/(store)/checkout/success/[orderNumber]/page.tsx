import { redirect } from "next/navigation";

import { CustomerOrderDetail } from "@/components/orders/customer-order-detail";
import { currentActor } from "@/modules/auth/session";
import { orderNumberRouteInput } from "@/modules/orders/validators";

export const metadata = { title: "ثبت سفارش | Apple333" };

export default async function CheckoutSuccessPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/account/login?callbackUrl=/checkout");
  if (!actor.permissions.has("orders.read_own")) redirect("/account");
  const { orderNumber } = orderNumberRouteInput.parse(await params);
  return <CustomerOrderDetail orderNumber={orderNumber} showSuccess />;
}
