import Link from "next/link";

import { AdminPermissionGuard } from "@/components/admin/admin-permission-guard";
import { PageContainer } from "@/components/admin/page-container";
import {
  formatPaymentDate,
  formatPaymentMoney,
  paymentStatusClass,
  paymentStatusLabel,
} from "@/components/payments/payment-ui";
import { requireAdminPagePermission } from "@/modules/auth/session";
import { paymentListQuery } from "@/modules/payments/validators";
import { listAdminPayments } from "@/server/services/payment-service";

export const metadata = { title: "مدیریت پرداخت‌ها | Apple333" };

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdminPagePermission("payments.read");
  const raw = await searchParams;
  const parsed = paymentListQuery.parse(
    Object.fromEntries(
      Object.entries(raw).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value]] : [],
      ),
    ),
  );
  const payments = await listAdminPayments(actor, parsed);
  return (
    <AdminPermissionGuard permission="payments.read">
      <PageContainer
        title="مدیریت پرداخت‌ها"
        description="جست‌وجو، تطبیق و ممیزی پرداخت‌های سرور-تأییدشده بدون نمایش داده‌های حساس کارت."
      >
        <form className="mb-5 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-5 md:grid-cols-4">
          <input
            name="query"
            defaultValue={parsed.query}
            placeholder="شماره پرداخت یا سفارش"
            className="rounded-xl border border-zinc-200 px-3 py-2"
          />
          <select
            name="status"
            defaultValue={parsed.status ?? ""}
            className="rounded-xl border border-zinc-200 px-3 py-2"
          >
            <option value="">همه وضعیت‌ها</option>
            {[
              "CREATED",
              "INITIALIZING",
              "PENDING",
              "AUTHORIZED",
              "PAID",
              "FAILED",
              "CANCELLED",
              "EXPIRED",
              "PARTIALLY_REFUNDED",
              "REFUNDED",
            ].map((status) => (
              <option key={status} value={status}>
                {paymentStatusLabel(status)}
              </option>
            ))}
          </select>
          {actor.permissions.has("payments.provider_reference.read") ? (
            <input
              name="providerReference"
              defaultValue={parsed.providerReference}
              placeholder="مرجع درگاه"
              className="rounded-xl border border-zinc-200 px-3 py-2"
            />
          ) : null}
          <select
            name="provider"
            defaultValue={parsed.provider ?? ""}
            className="rounded-xl border border-zinc-200 px-3 py-2"
          >
            <option value="">همه درگاه‌ها</option>
            <option value="PAYMENT_SIMULATOR">Payment Simulator</option>
          </select>
          <input
            type="date"
            name="from"
            aria-label="از تاریخ"
            defaultValue={parsed.from?.toISOString().slice(0, 10)}
            className="rounded-xl border border-zinc-200 px-3 py-2"
          />
          <input
            type="date"
            name="to"
            aria-label="تا تاریخ"
            defaultValue={parsed.to?.toISOString().slice(0, 10)}
            className="rounded-xl border border-zinc-200 px-3 py-2"
          />
          {actor.permissions.has("payments.read_financial") ? (
            <>
              <input
                name="minAmountRials"
                inputMode="numeric"
                defaultValue={parsed.minAmountRials}
                placeholder="حداقل مبلغ (ریال)"
                className="rounded-xl border border-zinc-200 px-3 py-2"
              />
              <input
                name="maxAmountRials"
                inputMode="numeric"
                defaultValue={parsed.maxAmountRials}
                placeholder="حداکثر مبلغ (ریال)"
                className="rounded-xl border border-zinc-200 px-3 py-2"
              />
            </>
          ) : null}
          <button className="rounded-xl bg-zinc-950 px-4 py-2 text-white">
            جست‌وجو
          </button>
        </form>
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
          <table className="w-full text-right text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="p-4">پرداخت</th>
                <th className="p-4">سفارش</th>
                <th className="p-4">مبلغ</th>
                <th className="p-4">وضعیت</th>
                <th className="p-4">تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {payments.items.map((payment) => (
                <tr key={payment.id} className="border-t border-zinc-100">
                  <td className="p-4 font-semibold">
                    <Link
                      href={`/admin/payments/${encodeURIComponent(payment.id)}`}
                    >
                      {payment.paymentNumber}
                    </Link>
                  </td>
                  <td className="p-4">{payment.orderNumber}</td>
                  <td className="p-4">
                    {formatPaymentMoney(payment.amountRials)}
                  </td>
                  <td className="p-4">
                    <span
                      className={`rounded-full px-2 py-1 ${paymentStatusClass(payment.status)}`}
                    >
                      {paymentStatusLabel(payment.status)}
                    </span>
                  </td>
                  <td className="p-4">
                    {formatPaymentDate(payment.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payments.items.length === 0 ? (
            <p className="p-8 text-center text-zinc-500">پرداختی یافت نشد.</p>
          ) : null}
        </div>
      </PageContainer>
    </AdminPermissionGuard>
  );
}
