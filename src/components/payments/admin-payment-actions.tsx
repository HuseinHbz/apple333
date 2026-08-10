"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminPaymentActions({
  paymentId,
  canReconcile,
  canRefund,
  providerAvailable,
}: {
  paymentId: string;
  canReconcile: boolean;
  canRefund: boolean;
  providerAvailable: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function command(path: string, payload: Record<string, string>) {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        success: boolean;
        error?: { message?: string };
      };
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? "عملیات مالی انجام نشد.");
      setMessage("عملیات با موفقیت ثبت شد.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "عملیات ناموفق بود.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 p-5">
      <h2 className="font-bold">عملیات کنترل‌شده مالی</h2>
      {!providerAvailable ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          عملیات درگاه تا فعال‌سازی و تأیید ارائه‌دهنده تولیدی مسدود است.
        </p>
      ) : null}
      {canReconcile && providerAvailable ? (
        <button
          type="button"
          disabled={pending}
          className="rounded-xl border border-zinc-300 px-4 py-2"
          onClick={() =>
            void command(
              `/api/admin/payments/${encodeURIComponent(paymentId)}/reconcile`,
              { idempotencyKey: `payment-reconcile:${crypto.randomUUID()}` },
            )
          }
        >
          تطبیق با درگاه
        </button>
      ) : null}
      {canRefund && providerAvailable ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-xl border border-zinc-200 px-3 py-2"
            inputMode="numeric"
            placeholder="مبلغ ریال"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <input
            className="rounded-xl border border-zinc-200 px-3 py-2"
            placeholder="دلیل بازپرداخت (حداقل ۸ حرف)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <button
            type="button"
            disabled={pending || !amount || reason.trim().length < 8}
            className="rounded-xl bg-rose-700 px-4 py-2 text-white disabled:opacity-50"
            onClick={() =>
              void command(
                `/api/admin/payments/${encodeURIComponent(paymentId)}/refunds`,
                {
                  idempotencyKey: `payment-refund:${crypto.randomUUID()}`,
                  amountRials: amount,
                  reason,
                  scenario: "refund_success",
                },
              )
            }
          >
            ثبت بازپرداخت آزمایشی
          </button>
        </div>
      ) : null}
      {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
    </div>
  );
}
