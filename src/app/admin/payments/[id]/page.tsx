import { AdminPermissionGuard } from "@/components/admin/admin-permission-guard";
import { PageContainer } from "@/components/admin/page-container";
import { AdminPaymentActions } from "@/components/payments/admin-payment-actions";
import {
  formatPaymentDate,
  formatPaymentMoney,
  paymentStatusClass,
  paymentStatusLabel,
} from "@/components/payments/payment-ui";
import { requireAdminPagePermission } from "@/modules/auth/session";
import { isPaymentSimulatorRuntimeAllowed } from "@/modules/payments/runtime-policy";
import { paymentIdRouteInput } from "@/modules/payments/validators";
import { getAdminPayment } from "@/server/services/payment-service";

export const metadata = { title: "جزئیات پرداخت | Apple333" };

export default async function AdminPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdminPagePermission("payments.read");
  const { id } = paymentIdRouteInput.parse(await params);
  const payment = await getAdminPayment(actor, id);
  return (
    <AdminPermissionGuard permission="payments.read">
      <PageContainer
        title={`پرداخت ${payment.paymentNumber}`}
        description={`سفارش ${payment.orderNumber} — شواهد امن تلاش‌ها، تأیید و بازپرداخت`}
      >
        <div className="space-y-5">
          <section className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 sm:grid-cols-4">
            <div>
              <p className="text-xs text-zinc-500">وضعیت</p>
              <span
                className={`mt-2 inline-block rounded-full px-3 py-1 ${paymentStatusClass(payment.status)}`}
              >
                {paymentStatusLabel(payment.status)}
              </span>
            </div>
            <div>
              <p className="text-xs text-zinc-500">مبلغ</p>
              <p className="mt-2 font-bold">
                {formatPaymentMoney(payment.amountRials)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">درگاه</p>
              <p className="mt-2">{payment.provider}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">ایجاد</p>
              <p className="mt-2">{formatPaymentDate(payment.createdAt)}</p>
            </div>
          </section>
          <AdminPaymentActions
            paymentId={payment.id}
            canReconcile={actor.permissions.has("payments.reconcile")}
            canRefund={actor.permissions.has("payments.refund")}
            providerAvailable={isPaymentSimulatorRuntimeAllowed()}
          />
          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="mb-4 font-bold">خط زمانی تلاش‌ها</h2>
            <ol className="space-y-3">
              {payment.attempts.map((attempt) => (
                <li
                  key={attempt.id}
                  className="rounded-xl bg-zinc-50 p-3 text-sm"
                >
                  تلاش {attempt.attemptNumber} —{" "}
                  {paymentStatusLabel(attempt.status)} —{" "}
                  {formatPaymentDate(attempt.createdAt)}
                </li>
              ))}
            </ol>
          </section>
          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="mb-4 font-bold">تراکنش‌های تغییرناپذیر</h2>
            <ul className="space-y-2 text-sm">
              {payment.transactions.map((transaction) => (
                <li
                  key={transaction.id}
                  className="flex flex-wrap justify-between gap-2 border-b border-zinc-100 pb-2"
                >
                  <span>
                    {transaction.type} / {transaction.status}
                    {transaction.providerCode
                      ? ` / ${transaction.providerCode}`
                      : ""}
                    {transaction.providerReference ? (
                      <code className="mr-2 rounded bg-zinc-100 px-2 py-1 text-xs">
                        {transaction.providerReference}
                      </code>
                    ) : null}
                  </span>
                  <span>{formatPaymentMoney(transaction.amountRials)}</span>
                </li>
              ))}
            </ul>
          </section>
          {payment.refunds.length > 0 ? (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="mb-4 font-bold">بازپرداخت‌ها</h2>
              {payment.refunds.map((refund) => (
                <p key={refund.id} className="mb-2 text-sm">
                  {formatPaymentMoney(refund.amountRials)} — {refund.status} —{" "}
                  {refund.reason}
                </p>
              ))}
            </section>
          ) : null}
          {"callbacks" in payment && payment.callbacks.length > 0 ? (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="mb-4 font-bold">شواهد امن Callback</h2>
              <ul className="space-y-2 text-sm">
                {payment.callbacks.map((callback) => (
                  <li key={callback.id} className="rounded-xl bg-zinc-50 p-3">
                    {callback.signatureStatus} / {callback.processingStatus} —{" "}
                    {formatPaymentDate(callback.receivedAt)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {"reconciliation" in payment && payment.reconciliation.length > 0 ? (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="mb-4 font-bold">وضعیت تطبیق مالی</h2>
              <ul className="space-y-2 text-sm">
                {payment.reconciliation.map((entry) => (
                  <li key={entry.id} className="rounded-xl bg-zinc-50 p-3">
                    {entry.differenceType} / {entry.resolutionStatus} —{" "}
                    {formatPaymentDate(entry.checkedAt)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {"outbox" in payment && payment.outbox.length > 0 ? (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="mb-4 font-bold">رویدادهای Outbox</h2>
              <ul className="space-y-2 text-sm">
                {payment.outbox.map((event) => (
                  <li key={event.id} className="rounded-xl bg-zinc-50 p-3">
                    {event.eventType} / v{event.aggregateVersion} /{" "}
                    {event.status}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {"auditTrail" in payment && payment.auditTrail.length > 0 ? (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="mb-4 font-bold">ردپای ممیزی</h2>
              <ul className="space-y-2 text-sm">
                {payment.auditTrail.map((entry) => (
                  <li key={entry.id} className="rounded-xl bg-zinc-50 p-3">
                    {entry.action} — {entry.actorType ?? "SYSTEM"} —{" "}
                    {entry.requestId} — {formatPaymentDate(entry.createdAt)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </PageContainer>
    </AdminPermissionGuard>
  );
}
