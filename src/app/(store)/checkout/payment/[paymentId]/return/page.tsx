import { redirect } from "next/navigation";

import { PaymentReturnVerifier } from "@/components/payments/payment-return-verifier";
import { currentActor } from "@/modules/auth/session";
import { paymentIdRouteInput } from "@/modules/payments/validators";
import { getCustomerPayment } from "@/server/services/payment-service";

export const metadata = { title: "تأیید پرداخت | Apple333" };

export default async function PaymentReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ authority?: string }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/account/login?callbackUrl=/checkout");
  const { id } = paymentIdRouteInput.parse({ id: (await params).paymentId });
  const payment = await getCustomerPayment(actor, id);
  const authority = (await searchParams).authority;
  if (!authority) redirect(`/checkout/payment/${encodeURIComponent(id)}`);
  return (
    <main className="min-h-[70vh] px-4 py-14" dir="rtl">
      <PaymentReturnVerifier
        paymentId={payment.id}
        orderNumber={payment.orderNumber}
        authority={authority}
      />
    </main>
  );
}

