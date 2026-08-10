"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function PaymentReturnVerifier({
  paymentId,
  orderNumber,
  authority,
}: {
  paymentId: string;
  orderNumber: string;
  authority: string;
}) {
  const started = useRef(false);
  const [state, setState] = useState<"pending" | "paid" | "failed">("pending");
  const [message, setMessage] = useState("در حال تأیید پرداخت از سمت سرور...");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const response = await fetch(
          `/api/store/payments/${encodeURIComponent(paymentId)}/verify`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              idempotencyKey: `payment-return:${crypto.randomUUID()}`,
              authority,
            }),
          },
        );
        const body = (await response.json()) as {
          success: boolean;
          data?: { status?: string };
          error?: { message?: string };
        };
        if (!response.ok || !body.success || body.data?.status !== "PAID") {
          throw new Error(body.error?.message ?? "پرداخت تأیید نشد.");
        }
        setState("paid");
        setMessage("پرداخت با موفقیت و به‌صورت سروری تأیید شد.");
      } catch (error) {
        setState("failed");
        setMessage(
          error instanceof Error ? error.message : "تأیید پرداخت ناموفق بود.",
        );
      }
    })();
  }, [authority, paymentId]);

  return (
    <section
      className="mx-auto max-w-xl rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm"
      data-testid="payment-return-verifier"
    >
      <div
        className={`mb-4 size-3 rounded-full ${state === "paid" ? "bg-emerald-500" : state === "failed" ? "bg-rose-500" : "animate-pulse bg-amber-500"}`}
      />
      <h1 className="text-2xl font-bold text-zinc-950">نتیجه پرداخت</h1>
      <p className="mt-3 leading-7 text-zinc-600" role="status">
        {message}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          className="rounded-xl bg-zinc-950 px-4 py-2 text-white"
          href={`/account/orders/${encodeURIComponent(orderNumber)}`}
        >
          مشاهده سفارش
        </Link>
        {state === "failed" ? (
          <Link
            className="rounded-xl border border-zinc-200 px-4 py-2"
            href={`/checkout/payment/${encodeURIComponent(paymentId)}`}
          >
            تلاش دوباره
          </Link>
        ) : null}
      </div>
    </section>
  );
}
