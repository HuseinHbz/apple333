"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PaymentSimulatorScenario } from "@/modules/payments/types";

type ApiEnvelope = Readonly<{
  success: boolean;
  data?: Readonly<{
    attempts: readonly Readonly<{
      redirectUrl: string | null;
      status: string;
    }>[];
  }>;
  error?: Readonly<{ message?: string }>;
}>;

export function CustomerPaymentActions({
  paymentId,
  canInitialize,
  providerAvailable,
}: {
  paymentId: string;
  canInitialize: boolean;
  providerAvailable: boolean;
}) {
  const router = useRouter();
  const [scenario, setScenario] = useState<PaymentSimulatorScenario>("success");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function initialize(): Promise<void> {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/store/payments/${encodeURIComponent(paymentId)}/initialize`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            idempotencyKey: `payment-ui:${crypto.randomUUID()}`,
            scenario,
            returnUrl: `${window.location.origin}/checkout/payment/${encodeURIComponent(paymentId)}/return`,
          }),
        },
      );
      const body = (await response.json()) as ApiEnvelope;
      if (!response.ok || !body.success) {
        throw new Error(body.error?.message ?? "اتصال به درگاه انجام نشد.");
      }
      const redirectUrl = body.data?.attempts.at(-1)?.redirectUrl;
      if (!redirectUrl) throw new Error("آدرس بازگشت درگاه دریافت نشد.");
      window.location.assign(redirectUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "عملیات ناموفق بود.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-3" data-testid="customer-payment-actions">
      {canInitialize && providerAvailable ? (
        <>
          <label className="block text-sm font-medium text-zinc-700">
            سناریوی درگاه آزمایشی
            <select
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2"
              value={scenario}
              onChange={(event) =>
                setScenario(event.target.value as PaymentSimulatorScenario)
              }
            >
              <option value="success">پرداخت موفق</option>
              <option value="declined">رد توسط درگاه</option>
              <option value="cancelled">لغو توسط کاربر</option>
              <option value="expired">انقضای پرداخت</option>
              <option value="wrong_amount">عدم تطابق مبلغ</option>
              <option value="timeout">Timeout آزمایشی</option>
            </select>
          </label>
          <button
            type="button"
            className="w-full rounded-xl bg-zinc-950 px-4 py-3 font-semibold text-white disabled:opacity-50"
            disabled={pending}
            onClick={() => void initialize()}
          >
            {pending ? "در حال اتصال..." : "ورود به درگاه امن آزمایشی"}
          </button>
        </>
      ) : !providerAvailable ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          درگاه پرداخت تولیدی هنوز فعال نشده است.
        </p>
      ) : (
        <button
          type="button"
          className="rounded-xl border border-zinc-200 px-4 py-2"
          onClick={() => router.refresh()}
        >
          به‌روزرسانی وضعیت
        </button>
      )}
      {message ? (
        <p
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
          role="alert"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
