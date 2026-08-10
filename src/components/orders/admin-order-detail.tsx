"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  ClipboardList,
  CreditCard,
  FileText,
  MapPinned,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApiRequest } from "@/modules/admin/api-client";

import {
  allocationStatusLabel,
  allocationStatusTone,
  createOrderRequestIdempotencyKey,
  formatOrderDate,
  formatOrderMoney,
  fulfillmentStatusLabel,
  fulfillmentStatusTone,
  isUnpaidPayment,
  orderRequestErrorMessage,
  orderSourceLabel,
  orderStatusChangeLabel,
  orderStatusLabel,
  orderStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
  type OrderDetail,
} from "./order-ui";

interface AdminOrderDetailProps {
  orderId: string;
  permissions: readonly string[];
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof ClipboardList;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-3xl shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-zinc-500" aria-hidden="true" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <div className="mt-2">
        <Badge tone={tone}>{value}</Badge>
      </div>
    </div>
  );
}

function AddressCard({
  title,
  address,
}: {
  title: string;
  address: OrderDetail["billingAddress"];
}) {
  if (!address)
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-5 text-sm text-zinc-500">
        {title} برای این سفارش ثبت نشده است.
      </div>
    );
  return (
    <div className="rounded-2xl border border-zinc-200 p-4">
      <p className="font-semibold text-zinc-900">{title}</p>
      <p className="mt-2 text-sm text-zinc-700">
        {address.recipientName} · {address.mobile}
      </p>
      <p className="mt-1 text-sm leading-6 text-zinc-600">
        {[address.province, address.city, address.line1, address.postalCode]
          .filter(Boolean)
          .join("، ")}
      </p>
    </div>
  );
}

function CancelOrderDialog({
  order,
  onCancel,
  isPending,
  error,
}: {
  order: OrderDetail;
  onCancel: (input: { reasonCode: string; note?: string }) => void;
  isPending: boolean;
  error: unknown;
}) {
  const [open, setOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");

  return (
    <ModalDialog
      open={open}
      onOpenChange={setOpen}
      title="لغو سفارش"
      description="لغو سفارش یک عملیات حساس است. دلیل لغو برای ثبت در سابقه لازم است و موجودی رزرو‌شده فقط در صورت مجازبودن وضعیت سفارش آزاد می‌شود."
      trigger={
        <Button variant="danger">
          <Ban className="size-4" aria-hidden="true" />
          لغو سفارش
        </Button>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onCancel({
            reasonCode: reasonCode.trim(),
            ...(note.trim() ? { note: note.trim() } : {}),
          });
        }}
      >
        <label className="block text-sm font-medium text-zinc-800">
          دلیل لغو
          <Input
            className="mt-2"
            maxLength={80}
            minLength={1}
            required
            value={reasonCode}
            onChange={(event) => setReasonCode(event.target.value)}
            placeholder="برای نمونه: CUSTOMER_REQUEST"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-800">
          یادداشت تکمیلی{" "}
          <span className="font-normal text-zinc-500">(اختیاری)</span>
          <textarea
            className="mt-2 min-h-24 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
            maxLength={1_000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="یادداشتی که در سابقه عملیاتی سفارش ثبت می‌شود"
          />
        </label>
        {error ? (
          <Alert title="لغو سفارش انجام نشد" tone="danger">
            <p>{orderRequestErrorMessage(error)}</p>
          </Alert>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="danger"
            disabled={isPending || !reasonCode.trim()}
          >
            {isPending ? "در حال ثبت لغو…" : "تأیید لغو سفارش"}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}

function ConfirmOrderDialog({
  order,
  onConfirm,
  isPending,
  error,
}: {
  order: OrderDetail;
  onConfirm: () => void;
  isPending: boolean;
  error: unknown;
}) {
  const [open, setOpen] = useState(false);
  return (
    <ModalDialog
      open={open}
      onOpenChange={setOpen}
      title="تأیید سفارش"
      description="تأیید فقط وقتی انجام می‌شود که سرویس سفارش، رزرو و تخصیص معتبر موجودی را تأیید کند."
      trigger={
        <Button>
          <BadgeCheck className="size-4" aria-hidden="true" />
          تأیید سفارش
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-zinc-600">
          سفارش {order.orderNumber} پس از بررسی سمت سرور تأیید می‌شود. این صفحه
          هیچ وضعیت یا مبلغی را محلی تغییر نمی‌دهد.
        </p>
        {error ? (
          <Alert title="تأیید سفارش انجام نشد" tone="danger">
            <p>{orderRequestErrorMessage(error)}</p>
          </Alert>
        ) : null}
        <div className="flex justify-end">
          <Button disabled={isPending} onClick={onConfirm}>
            {isPending ? "در حال تأیید…" : "تأیید نهایی"}
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}

function DeviceAssignmentList({
  units,
}: {
  units: OrderDetail["allocations"][number]["deviceUnits"];
}) {
  if (units.length === 0) return null;
  return (
    <dl className="mt-3 space-y-2 border-t border-dashed border-zinc-200 pt-3 text-xs text-zinc-600">
      {units.map((unit) => (
        <div key={unit.id} className="rounded-xl bg-zinc-50 p-2">
          <dt className="font-semibold text-zinc-800">
            دستگاه تخصیص‌یافته · {unit.status}
          </dt>
          {unit.imei ? (
            <dd className="mt-1" dir="ltr">
              IMEI: {unit.imei}
            </dd>
          ) : null}
          {unit.serialNumber ? (
            <dd className="mt-1" dir="ltr">
              Serial: {unit.serialNumber}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

export function AdminOrderDetail({
  orderId,
  permissions,
}: AdminOrderDetailProps) {
  const permissionSet = new Set(permissions);
  const canViewFinancials = permissionSet.has("orders.view_financials");
  const canViewCustomerPii = permissionSet.has("orders.view_customer_pii");
  const canViewImei = permissionSet.has("orders.view_imei");
  const canViewAudit = permissionSet.has("orders.audit.read");
  const canViewInternalNotes = permissionSet.has("orders.add_internal_note");
  const queryClient = useQueryClient();
  const path = `/api/admin/orders/${encodeURIComponent(orderId)}`;
  const orderQuery = useQuery({
    queryKey: ["admin", "orders", orderId],
    queryFn: () => adminApiRequest<OrderDetail>(path),
    staleTime: 5_000,
  });

  const refreshOrder = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
  };

  const confirm = useMutation({
    mutationFn: (order: OrderDetail) => {
      const idempotencyKey = createOrderRequestIdempotencyKey();
      return adminApiRequest<OrderDetail>(`${path}/confirm`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          expectedVersion: order.version,
          idempotencyKey,
        }),
      });
    },
    onSuccess: refreshOrder,
  });

  const cancel = useMutation({
    mutationFn: ({
      order,
      reasonCode,
      note,
    }: {
      order: OrderDetail;
      reasonCode: string;
      note?: string;
    }) => {
      const idempotencyKey = createOrderRequestIdempotencyKey();
      return adminApiRequest<OrderDetail>(`${path}/cancel`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          expectedVersion: order.version,
          reasonCode,
          ...(note ? { note } : {}),
          idempotencyKey,
        }),
      });
    },
    onSuccess: refreshOrder,
  });

  if (orderQuery.isPending) {
    return (
      <div
        className="space-y-4"
        role="status"
        aria-live="polite"
        aria-label="در حال دریافت سفارش"
      >
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="جزئیات سفارش در دسترس نیست"
        description={
          orderQuery.isError
            ? orderRequestErrorMessage(orderQuery.error)
            : "اطلاعات سفارش دریافت نشد."
        }
        action={
          <Link href="/admin/orders">
            <Button variant="secondary">
              <ArrowRight className="size-4" aria-hidden="true" />
              بازگشت به فهرست
            </Button>
          </Link>
        }
      />
    );
  }

  const order = orderQuery.data;
  const canConfirm =
    permissionSet.has("orders.confirm") &&
    order.status === "PENDING_CONFIRMATION";
  const canCancel =
    (isUnpaidPayment(order.paymentStatus)
      ? permissionSet.has("orders.cancel")
      : permissionSet.has("orders.cancel_after_payment")) &&
    !["COMPLETED", "CANCELLED", "REJECTED"].includes(order.status);
  const publicNotes = order.notes.filter(
    (note) => note.visibility === "CUSTOMER",
  );
  const internalNotes = order.notes.filter(
    (note) => note.visibility === "INTERNAL",
  );

  return (
    <div className="space-y-5" data-testid="admin-order-detail">
      <Card className="rounded-3xl border-zinc-300 shadow-none">
        <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <Link
                href="/admin/orders"
                className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-600 hover:text-zinc-950"
              >
                <ArrowRight className="size-4" aria-hidden="true" />
                بازگشت به سفارش‌ها
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-black tracking-tight text-zinc-950">
                  {order.orderNumber}
                </h2>
                <Badge tone={orderStatusTone(order.status)}>
                  {orderStatusLabel(order.status)}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                ثبت از {orderSourceLabel(order.source)} در{" "}
                {formatOrderDate(order.createdAt)} · نسخه عملیاتی{" "}
                {new Intl.NumberFormat("fa-IR").format(order.version)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={orderQuery.isFetching}
                onClick={() => void orderQuery.refetch()}
              >
                <RefreshCw
                  className={
                    orderQuery.isFetching ? "size-4 animate-spin" : "size-4"
                  }
                  aria-hidden="true"
                />
                تازه‌سازی
              </Button>
              {canConfirm ? (
                <ConfirmOrderDialog
                  order={order}
                  onConfirm={() => confirm.mutate(order)}
                  isPending={confirm.isPending}
                  error={confirm.error}
                />
              ) : null}
              {canCancel ? (
                <CancelOrderDialog
                  order={order}
                  onCancel={(input) => cancel.mutate({ order, ...input })}
                  isPending={cancel.isPending}
                  error={cancel.error}
                />
              ) : null}
            </div>
          </div>
          {confirm.isSuccess || cancel.isSuccess ? (
            <Alert title="سفارش به‌روزرسانی شد" tone="success">
              <p>اطلاعات تازه از سرویس سفارش دریافت شد.</p>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <section
        aria-label="خلاصه وضعیت سفارش"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Metric
          label="وضعیت سفارش"
          value={orderStatusLabel(order.status)}
          tone={orderStatusTone(order.status)}
        />
        <Metric
          label="وضعیت پرداخت"
          value={paymentStatusLabel(order.paymentStatus)}
          tone={paymentStatusTone(order.paymentStatus)}
        />
        <Metric
          label="تخصیص موجودی"
          value={allocationStatusLabel(order.allocationStatus)}
          tone={allocationStatusTone(order.allocationStatus)}
        />
        <Metric
          label="تحویل"
          value={fulfillmentStatusLabel(order.fulfillmentStatus)}
          tone={fulfillmentStatusTone(order.fulfillmentStatus)}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,0.9fr)]">
        <div className="space-y-5">
          <DetailSection icon={PackageCheck} title="اقلام سفارش">
            <div className="divide-y divide-zinc-100">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-zinc-950">
                      {item.snapshot.productName}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      {item.snapshot.variantName ?? "مدل پایه"} ·{" "}
                      <span dir="ltr">{item.snapshot.sku}</span>
                    </p>
                    {item.snapshot.warranty?.name ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        گارانتی: {item.snapshot.warranty.name}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold text-zinc-950">
                      {formatOrderMoney(item.lineTotalRials)}
                    </p>
                    <p className="mt-1 text-zinc-500">
                      {new Intl.NumberFormat("fa-IR").format(item.quantity)} ×{" "}
                      {formatOrderMoney(item.unitPriceRials)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </DetailSection>

          <DetailSection icon={Truck} title="تخصیص و تحویل">
            <div className="space-y-4">
              {order.allocations.length ? (
                <div className="space-y-2">
                  {order.allocations.map((allocation) => (
                    <div
                      key={allocation.id}
                      className="rounded-2xl border border-zinc-200 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-zinc-900">
                          {allocation.branch.name}
                        </p>
                        <Badge tone={allocationStatusTone(allocation.status)}>
                          {allocationStatusLabel(allocation.status)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-zinc-600">
                        انبار: {allocation.warehouse.name} · تعداد:{" "}
                        {new Intl.NumberFormat("fa-IR").format(
                          allocation.quantity,
                        )}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        رزرو: {allocation.reservationStatus ?? "ثبت نشده"}
                      </p>
                      {canViewImei ? (
                        <DeviceAssignmentList units={allocation.deviceUnits} />
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">
                  هنوز تخصیص موجودی برای این سفارش ثبت نشده است.
                </p>
              )}
              <div className="border-t border-dashed border-zinc-200 pt-4">
                {order.fulfillment ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-zinc-900">
                        {order.fulfillment.method === "PICKUP"
                          ? "تحویل حضوری"
                          : "ارسال به آدرس"}
                      </p>
                      <Badge
                        tone={fulfillmentStatusTone(order.fulfillment.status)}
                      >
                        {fulfillmentStatusLabel(order.fulfillment.status)}
                      </Badge>
                    </div>
                    <p className="text-zinc-600">
                      {order.fulfillment.branch?.name ??
                        order.fulfillment.warehouse?.name ??
                        "محل تحویل پس از تخصیص مشخص می‌شود"}
                    </p>
                    {order.fulfillment.trackingCode ? (
                      <p className="text-zinc-600">
                        کد رهگیری:{" "}
                        <span dir="ltr">{order.fulfillment.trackingCode}</span>
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">
                    اطلاعات تحویل هنوز ثبت نشده است.
                  </p>
                )}
              </div>
            </div>
          </DetailSection>

          <DetailSection icon={FileText} title="یادداشت‌ها">
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-bold tracking-wide text-zinc-500">
                  قابل مشاهده برای مشتری
                </p>
                {publicNotes.length ? (
                  <div className="space-y-2">
                    {publicNotes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-2xl bg-zinc-50 p-3 text-sm"
                      >
                        <p className="text-zinc-700">{note.content}</p>
                        <p className="mt-2 text-xs text-zinc-500">
                          {formatOrderDate(note.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">
                    یادداشت قابل‌نمایش برای مشتری وجود ندارد.
                  </p>
                )}
              </div>
              {canViewInternalNotes ? (
                <div className="border-t border-dashed border-zinc-200 pt-4">
                  <p className="mb-2 text-xs font-bold tracking-wide text-zinc-500">
                    داخلی
                  </p>
                  {internalNotes.length ? (
                    <div className="space-y-2">
                      {internalNotes.map((note) => (
                        <div
                          key={note.id}
                          className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3 text-sm"
                        >
                          <p className="text-zinc-700">{note.content}</p>
                          <p className="mt-2 text-xs text-zinc-500">
                            {note.authorName ?? "کاربر داخلی"} ·{" "}
                            {formatOrderDate(note.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">
                      یادداشت داخلی ثبت نشده است.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </DetailSection>
        </div>

        <aside className="space-y-5">
          <DetailSection icon={UserRound} title="مشتری و نشانی">
            {canViewCustomerPii ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="font-semibold text-zinc-950">
                    {order.customer.name ?? "مشتری مهمان"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {order.customer.mobile ??
                      order.customer.email ??
                      "راه تماس ثبت نشده"}
                  </p>
                </div>
                <AddressCard
                  title="نشانی صورتحساب"
                  address={order.billingAddress}
                />
                <AddressCard
                  title="نشانی تحویل"
                  address={order.shippingAddress}
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                مشخصات شناسایی و نشانی مشتری فقط با مجوز مستقل نمایش داده
                می‌شود.
              </div>
            )}
          </DetailSection>

          {canViewFinancials && order.pricing ? (
            <DetailSection icon={CreditCard} title="خلاصه مالی">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3 text-zinc-600">
                  <span>جمع اقلام</span>
                  <span>{formatOrderMoney(order.pricing.subtotalRials)}</span>
                </div>
                <div className="flex justify-between gap-3 text-zinc-600">
                  <span>تخفیف</span>
                  <span>
                    {formatOrderMoney(order.pricing.discountTotalRials)}
                  </span>
                </div>
                <div className="flex justify-between gap-3 text-zinc-600">
                  <span>مالیات و هزینه</span>
                  <span>
                    {formatOrderMoney(
                      (
                        BigInt(order.pricing.taxTotalRials) +
                        BigInt(order.pricing.shippingTotalRials) +
                        BigInt(order.pricing.feeTotalRials)
                      ).toString(),
                    )}
                  </span>
                </div>
                <div className="border-t border-dashed border-zinc-200 pt-3 text-base font-black text-zinc-950">
                  <div className="flex justify-between gap-3">
                    <span>مبلغ نهایی</span>
                    <span>
                      {formatOrderMoney(order.pricing.grandTotalRials)}
                    </span>
                  </div>
                </div>
              </div>
              {order.payments.length ? (
                <div className="mt-5 border-t border-dashed border-zinc-200 pt-4">
                  <p className="mb-2 text-xs font-bold tracking-wide text-zinc-500">
                    تلاش‌های پرداخت
                  </p>
                  <div className="space-y-2">
                    {order.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="rounded-2xl bg-zinc-50 p-3 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>{payment.provider}</span>
                          <Badge tone={paymentStatusTone(payment.status)}>
                            {paymentStatusLabel(payment.status)}
                          </Badge>
                        </div>
                        <p className="mt-2 text-zinc-600">
                          {formatOrderMoney(payment.amountRials)} ·{" "}
                          {formatOrderDate(payment.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </DetailSection>
          ) : null}

          <DetailSection
            icon={ShieldCheck}
            title={canViewAudit ? "خط زمانی و ممیزی" : "خط زمانی سفارش"}
          >
            {order.timeline.length ? (
              <ol className="space-y-4 border-r border-zinc-200 pr-4">
                {order.timeline.map((entry) => (
                  <li key={entry.id} className="relative">
                    <span
                      className="absolute -right-[1.25rem] top-1.5 size-2.5 rounded-full border-2 border-white bg-zinc-400"
                      aria-hidden="true"
                    />
                    <p className="font-semibold text-zinc-900">
                      {orderStatusChangeLabel(entry.fromStatus, entry.toStatus)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatOrderDate(entry.createdAt)}
                    </p>
                    {entry.reasonCode ? (
                      <p className="mt-2 text-sm text-zinc-600">
                        دلیل: {entry.reasonCode}
                      </p>
                    ) : null}
                    {canViewAudit && entry.note ? (
                      <p className="mt-1 text-sm text-zinc-600">{entry.note}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-zinc-500">
                هنوز رویدادی برای این سفارش ثبت نشده است.
              </p>
            )}
          </DetailSection>

          <DetailSection icon={MapPinned} title="اطلاعات عملیاتی">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">روش تحویل</dt>
                <dd className="font-medium text-zinc-900">
                  {order.fulfillmentMethod === "PICKUP"
                    ? "تحویل حضوری"
                    : "ارسال"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">نوع سفارش</dt>
                <dd className="font-medium text-zinc-900">{order.type}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">آخرین تغییر</dt>
                <dd className="font-medium text-zinc-900">
                  {formatOrderDate(order.updatedAt)}
                </dd>
              </div>
            </dl>
          </DetailSection>
        </aside>
      </div>
    </div>
  );
}
