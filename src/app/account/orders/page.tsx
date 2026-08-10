import { redirect } from "next/navigation";

import { CustomerOrderList } from "@/components/orders/customer-order-list";
import { currentActor } from "@/modules/auth/session";

export const metadata = { title: "سفارش‌های من | Apple333" };

export default async function AccountOrdersPage() {
  const actor = await currentActor();
  if (!actor) redirect("/account/login?callbackUrl=/account/orders");
  if (!actor.permissions.has("orders.read_own")) redirect("/account");
  return <CustomerOrderList />;
}
