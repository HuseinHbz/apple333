"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  ClipboardList,
  MapPin,
  PackageCheck,
  RefreshCw,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { storeApi } from "@/lib/store-api";

import {
  canCancelCustomerOrder,
  createOrderRequestIdempotencyKey,
  formatOrderDate,
  formatOrderMoney,
  fulfillmentStatusLabel,
  fulfillmentStatusTone,
  orderRequestErrorMessage,
  orderStatusChangeLabel,
  orderStatusLabel,
  orderStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
  type OrderDetail,
} from "./order-ui";

function CustomerCancelDialog({
  order,
  onSubmit,
  pending,
  error,
}: {
  order: OrderDetail;
  onSubmit: (reasonCode: string) => void;
  pending: boolean;
  error: unknown;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("CUSTOMER_REQUEST");
  return (
    <ModalDialog
      open={open}
      onOpenChange={setOpen}
      title="لغو سفارش"
      description="تا پیش از تأیید نهایی سفارش می‌توانید درخواست لغو ثبت کنید. موجودی رزروشده فقط پس از پذیرش امن درخواست آزاد می‌شود."
      trigger={
        <Button variant="danger">
          <Ban className="size-4" aria-hidden="true" />
          درخواست لغو
        </Button>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(reason.trim());
        }}
      >
        <label className="block text-sm font-medium text-zinc-800">
          دلیل درخواست
          <input
            className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100"
            value={reason}
            minLength={1}
            maxLength={80}
            required
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {error ? (
          <Alert title="درخواست لغو ثبت نشد" tone="danger">
            <p>{orderRequestErrorMessage(error)}</p>
          </Alert>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="danger"
            disabled={pending || !reason.trim()}
          >
            {pending ? "در حال ثبت…" : "تأیید درخواست لغو"}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}

export function CustomerOrderDetail({
  orderNumber,
  showSuccess = false,
}: {
  orderNumber: string;
  showSuccess?: boolean;
}) {
  const queryClient = useQueryClient();
  const path = `/api/store/orders/${encodeURIComponent(orderNumber)}`;
  const orderQuery = useQuery({
    queryKey: ["storefront-order", orderNumber],
    queryFn: () => storeApi<OrderDetail>(path),
    staleTime: 5_000,
  });
  const cancel = useMutation({
    mutationFn: (order: OrderDetail) => {
      const idempotencyKey = createOrderRequestIdempotencyKey();
      return storeApi<OrderDetail>(`${path}/cancel`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          expectedVersion: order.version,
          reasonCode: "CUSTOMER_REQUEST",
          idempotencyKey,
        }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["storefront-order", orderNumber],
      });
      await queryClient.invalidateQueries({ queryKey: ["storefront-orders"] });
    },
  });

  if (orderQuery.isPending) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </main>
    );
  }
  if (orderQuery.isError || !orderQuery.data) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState
          icon={ClipboardList}
          title="جزئیات سفارش در دسترس نیست"
          description={
            orderQuery.isError
              ? orderRequestErrorMessage(orderQuery.error)
              : "سفارش موردنظر پیدا نشد."
          }
          action={
            <Link href="/account/orders">
              <Button variant="secondary">
                <ArrowRight className="size-4" aria-hidden="true" />
                بازگشت به سفارش‌ها
              </Button>
            </Link>
          }
        />
      </main>
    );
  }

  const order = orderQuery.data;
  return (
    <main
      id="storefront-content"
      className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8"
      data-testid="customer-order-detail"
    >
      {showSuccess ? (
        <Alert title="سفارش شما با موفقیت ثبت شد" tone="success">
          <p>
            شمارهٔ سفارش را نگه دارید. وضعیت سفارش و پرداخت در همین صفحه
            به‌روزرسانی می‌شود.
          </p>
        </Alert>
      ) : null}
      <Card className="mt-5 rounded-3xl border-zinc-300 shadow-none">
        <CardContent className="flex flex-col gap-5 p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <Link
                className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-600 hover:text-zinc-950"
                href="/account/orders"
              >
                <ArrowRight className="size-4" aria-hidden="true" />
                سفارش‌های من
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-zinc-950">
                  {order.orderNumber}
                </h1>
                <Badge tone={orderStatusTone(order.status)}>
                  {orderStatusLabel(order.status)}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-zinc-600">
                ثبت در {formatOrderDate(order.createdAt)}
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
                به‌روزرسانی
              </Button>
              {canCancelCustomerOrder(order.status) &&
              order.paymentStatus !== "PAID" ? (
                <CustomerCancelDialog
                  order={order}
                  pending={cancel.isPending}
                  error={cancel.error}
                  onSubmit={() => cancel.mutate(order)}
                />
              ) : null}
            </div>
          </div>
          {cancel.isSuccess ? (
            <Alert title="درخواست لغو ثبت شد" tone="success">
              <p>نتیجهٔ نهایی در وضعیت سفارش نمایش داده می‌شود.</p>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <section
        className="mt-5 grid gap-3 sm:grid-cols-3"
        aria-label="وضعیت سفارش"
      >
        <Card className="rounded-3xl shadow-none">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500">پرداخت</p>
            <div className="mt-2">
              <Badge tone={paymentStatusTone(order.paymentStatus)}>
                {paymentStatusLabel(order.paymentStatus)}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-3xl shadow-none">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500">تحویل</p>
            <div className="mt-2">
              <Badge tone={fulfillmentStatusTone(order.fulfillmentStatus)}>
                {fulfillmentStatusLabel(order.fulfillmentStatus)}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-3xl shadow-none">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500">مبلغ نهایی</p>
            <p className="mt-2 font-black text-zinc-950">
              {formatOrderMoney(order.pricing?.grandTotalRials ?? null)}
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <div className="space-y-5">
          <Card className="rounded-3xl shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageCheck
                  className="size-4 text-zinc-500"
                  aria-hidden="true"
                />
                اقلام سفارش
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-zinc-100">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between gap-4 py-4 first:pt-0"
                >
                  <div>
                    <p className="font-semibold text-zinc-950">
                      {item.snapshot.productName}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      {item.snapshot.variantName ?? "مدل پایه"} ·{" "}
                      {new Intl.NumberFormat("fa-IR").format(item.quantity)} عدد
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold text-zinc-950">
                    {formatOrderMoney(item.lineTotalRials)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="rounded-3xl shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList
                  className="size-4 text-zinc-500"
                  aria-hidden="true"
                />
                روند سفارش
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.timeline.length ? (
                <ol className="space-y-4 border-r border-zinc-200 pr-4">
                  {order.timeline.map((entry) => (
                    <li key={entry.id} className="relative">
                      <span
                        className="absolute -right-[1.25rem] top-1.5 size-2.5 rounded-full border-2 border-white bg-zinc-400"
                        aria-hidden="true"
                      />
                      <p className="font-semibold text-zinc-900">
                        {orderStatusChangeLabel(
                          entry.fromStatus,
                          entry.toStatus,
                        )}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatOrderDate(entry.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-zinc-500">
                  هنوز رویدادی برای سفارش ثبت نشده است.
                </p>
              )}
            </CardContent>
          </Card>
          {order.notes.length ? (
            <Card className="rounded-3xl shadow-none">
              <CardHeader>
                <CardTitle>یادداشت‌های سفارش</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.notes.map((note) => (
                  <div key={note.id} className="rounded-2xl bg-zinc-50 p-3">
                    <p className="text-sm text-zinc-700">{note.content}</p>
                    <p className="mt-2 text-xs text-zinc-500">
                      {formatOrderDate(note.createdAt)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
        <aside className="space-y-5">
          <Card className="rounded-3xl shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="size-4 text-zinc-500" aria-hidden="true" />
                تحویل
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-zinc-600">
              {order.fulfillment ? (
                <>
                  <p className="font-semibold text-zinc-900">
                    {order.fulfillment.method === "PICKUP"
                      ? "تحویل حضوری"
                      : "ارسال به نشانی"}
                  </p>
                  <p>
                    {order.fulfillment.branch?.name ??
                      order.fulfillment.warehouse?.name ??
                      "محل تحویل پس از آماده‌سازی مشخص می‌شود."}
                  </p>
                  {order.fulfillment.trackingCode ? (
                    <p>
                      کد رهگیری:{" "}
                      <span dir="ltr">{order.fulfillment.trackingCode}</span>
                    </p>
                  ) : null}
                </>
              ) : (
                <p>اطلاعات تحویل پس از تأیید سفارش نمایش داده می‌شود.</p>
              )}
            </CardContent>
          </Card>
          {order.shippingAddress ? (
            <Card className="rounded-3xl shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="size-4 text-zinc-500" aria-hidden="true" />
                  نشانی تحویل
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-7 text-zinc-600">
                <p className="font-semibold text-zinc-900">
                  {order.shippingAddress.recipientName}
                </p>
                <p>
                  {[
                    order.shippingAddress.province,
                    order.shippingAddress.city,
                    order.shippingAddress.line1,
                    order.shippingAddress.postalCode,
                  ]
                    .filter(Boolean)
                    .join("، ")}
                </p>
              </CardContent>
            </Card>
          ) : null}
          <Card className="rounded-3xl shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2
                  className="size-4 text-zinc-500"
                  aria-hidden="true"
                />
                خلاصه مالی
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-zinc-600">جمع اقلام</span>
                <span>
                  {formatOrderMoney(order.pricing?.subtotalRials ?? null)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-600">تخفیف</span>
                <span>
                  {formatOrderMoney(order.pricing?.discountTotalRials ?? null)}
                </span>
              </div>
              <div className="border-t border-dashed border-zinc-200 pt-3 font-black text-zinc-950">
                <div className="flex justify-between gap-3">
                  <span>مبلغ نهایی</span>
                  <span>
                    {formatOrderMoney(order.pricing?.grandTotalRials ?? null)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
