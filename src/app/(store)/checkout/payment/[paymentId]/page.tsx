import Link from "next/link";
import { redirect } from "next/navigation";

import { CustomerPaymentActions } from "@/components/payments/customer-payment-actions";
import {
  formatPaymentDate,
  formatPaymentMoney,
  paymentStatusClass,
  paymentStatusLabel,
} from "@/components/payments/payment-ui";
import { currentActor } from "@/modules/auth/session";
import { isPaymentSimulatorRuntimeAllowed } from "@/modules/payments/runtime-policy";
import { paymentIdRouteInput } from "@/modules/payments/validators";
import { getCustomerPayment } from "@/server/services/payment-service";

export const metadata = { title: "پرداخت امن سفارش | Apple333" };

export default async function CheckoutPaymentPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/account/login?callbackUrl=/checkout");
  const { id } = paymentIdRouteInput.parse({ id: (await params).paymentId });
  const payment = await getCustomerPayment(actor, id);
  const providerAvailable = isPaymentSimulatorRuntimeAllowed();
  const canInitialize =
    providerAvailable &&
    ["CREATED", "FAILED", "EXPIRED"].includes(payment.status);
  return (
    <main className="mx-auto min-h-[70vh] max-w-3xl px-4 py-12" dir="rtl">
      <div className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">پرداخت {payment.paymentNumber}</p>
            <h1 className="mt-1 text-2xl font-bold text-zinc-950">
              پرداخت سفارش {payment.orderNumber}
            </h1>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${paymentStatusClass(payment.status)}`}
          >
            {paymentStatusLabel(payment.status)}
          </span>
        </div>
        <dl className="my-7 grid gap-4 rounded-2xl bg-zinc-50 p-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500">مبلغ قطعی سفارش</dt>
            <dd className="mt-1 font-bold">{formatPaymentMoney(payment.amountRials)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">تاریخ ایجاد</dt>
            <dd className="mt-1">{formatPaymentDate(payment.createdAt)}</dd>
          </div>
        </dl>
        <CustomerPaymentActions
          paymentId={payment.id}
          canInitialize={canInitialize}
          providerAvailable={providerAvailable}
        />
        <p className="mt-5 text-xs leading-6 text-zinc-500">
          اطلاعات کارت، CVV و رمز پویا در Apple333 ذخیره نمی‌شود. موفقیت فقط پس از
          تأیید سروری ثبت خواهد شد.
        </p>
        <Link
          className="mt-5 inline-block text-sm underline"
          href={`/account/orders/${encodeURIComponent(payment.orderNumber)}`}
        >
          بازگشت به سفارش
        </Link>
      </div>
    </main>
  );
}
