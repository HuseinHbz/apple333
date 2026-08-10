import type { PaymentStatus } from "@/modules/payments/types";

export function formatPaymentMoney(value: string | null): string {
  if (value === null) return "مبلغ محرمانه";
  try {
    return `${new Intl.NumberFormat("fa-IR").format(BigInt(value))} ریال`;
  } catch {
    return "مبلغ نامعتبر";
  }
}

export function formatPaymentDate(value: string): string {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function paymentStatusLabel(status: PaymentStatus | string): string {
  const labels: Readonly<Record<string, string>> = {
    CREATED: "ایجاد شده",
    INITIALIZING: "در حال اتصال به درگاه",
    PENDING: "در انتظار تأیید",
    AUTHORIZED: "مجاز شده",
    PAID: "پرداخت موفق",
    FAILED: "ناموفق",
    CANCELLED: "لغو شده",
    EXPIRED: "منقضی شده",
    PARTIALLY_REFUNDED: "بازپرداخت جزئی",
    REFUNDED: "بازپرداخت کامل",
  };
  return labels[status] ?? status;
}

export function paymentStatusClass(status: PaymentStatus | string): string {
  if (status === "PAID" || status === "REFUNDED")
    return "bg-emerald-100 text-emerald-800";
  if (["FAILED", "CANCELLED", "EXPIRED"].includes(status))
    return "bg-rose-100 text-rose-800";
  if (["INITIALIZING", "PENDING", "AUTHORIZED"].includes(status))
    return "bg-amber-100 text-amber-800";
  return "bg-zinc-100 text-zinc-700";
}
