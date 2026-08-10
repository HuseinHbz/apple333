"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PaymentDto } from "@/modules/payments/types";
import {
  formatPaymentMoney,
  paymentStatusClass,
  paymentStatusLabel,
} from "./payment-ui";

export function OrderPaymentSummary({
  orderNumber,
  payment,
  providerAvailable,
}: {
  orderNumber: string;
  payment: PaymentDto | null;
  providerAvailable: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/store/orders/${encodeURIComponent(orderNumber)}/payments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            idempotencyKey: `payment-create:${crypto.randomUUID()}`,
            provider: "PAYMENT_SIMULATOR",
          }),
        },
      );
      const body = (await response.json()) as {
        success: boolean;
        data?: { id?: string };
        error?: { message?: string };
      };
      if (!response.ok || !body.success || !body.data?.id) {
        throw new Error(body.error?.message ?? "پرداخت ایجاد نشد.");
      }
      router.push(`/checkout/payment/${encodeURIComponent(body.data.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "عملیات ناموفق بود.");
      setPending(false);
    }
  }

  return (
    <section
      className="mx-auto mt-5 max-w-5xl rounded-3xl border border-zinc-200 bg-white p-6"
      dir="rtl"
      data-testid="order-payment-summary"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">پرداخت سفارش</h2>
          {payment ? (
            <p className="mt-2 text-sm text-zinc-600">
              {payment.paymentNumber} —{" "}
              {formatPaymentMoney(payment.amountRials)}
            </p>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">
              پرداخت امن این سفارش هنوز آغاز نشده است.
            </p>
          )}
        </div>
        {payment ? (
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-sm ${paymentStatusClass(payment.status)}`}
            >
              {paymentStatusLabel(payment.status)}
            </span>
            <Link
              className="rounded-xl bg-zinc-950 px-4 py-2 text-white"
              href={`/checkout/payment/${encodeURIComponent(payment.id)}`}
            >
              مشاهده پرداخت
            </Link>
          </div>
        ) : providerAvailable ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void create()}
            className="rounded-xl bg-zinc-950 px-4 py-2 text-white disabled:opacity-50"
          >
            {pending ? "در حال ایجاد..." : "ایجاد پرداخت امن"}
          </button>
        ) : (
          <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">
            درگاه پرداخت تولیدی هنوز فعال نشده است.
          </p>
        )}
      </div>
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </section>
  );
}
