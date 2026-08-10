"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ClipboardList,
  PackageCheck,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { storeApi } from "@/lib/store-api";

import {
  formatOrderDate,
  formatOrderMoney,
  fulfillmentStatusLabel,
  fulfillmentStatusTone,
  orderRequestErrorMessage,
  orderStatusLabel,
  orderStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
  type OrderListItem,
  type OrderPage,
} from "./order-ui";

function OrderPager({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="صفحه‌بندی سفارش‌های من"
      className="mt-5 flex items-center justify-between gap-3"
    >
      <p className="text-xs text-zinc-600">
        صفحه {new Intl.NumberFormat("fa-IR").format(page)} از{" "}
        {new Intl.NumberFormat("fa-IR").format(totalPages)}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          قبل
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          بعد
        </Button>
      </div>
    </nav>
  );
}

export function CustomerOrderList() {
  const [page, setPage] = useState(1);
  const path = `/api/store/orders?page=${page}&pageSize=12`;
  const orders = useQuery({
    queryKey: ["storefront-orders", page],
    queryFn: () => storeApi<OrderPage<OrderListItem>>(path),
    staleTime: 10_000,
  });

  return (
    <main
      id="storefront-content"
      className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8"
      data-testid="customer-order-list"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-zinc-600">
            MY ORDERS
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl">
            سفارش‌های من
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600">
            وضعیت ثبت، پرداخت و تحویل سفارش‌های شما در این بخش نمایش داده
            می‌شود.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={orders.isFetching}
          onClick={() => void orders.refetch()}
        >
          <RefreshCw
            className={orders.isFetching ? "size-4 animate-spin" : "size-4"}
            aria-hidden="true"
          />
          به‌روزرسانی
        </Button>
      </div>

      <section className="mt-8" aria-label="فهرست سفارش‌های من">
        {orders.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-40 w-full rounded-3xl" />
            <Skeleton className="h-40 w-full rounded-3xl" />
          </div>
        ) : null}
        {orders.isError ? (
          <Alert title="سفارش‌ها دریافت نشدند" tone="danger">
            <p>{orderRequestErrorMessage(orders.error)}</p>
          </Alert>
        ) : null}
        {!orders.isPending &&
        !orders.isError &&
        orders.data?.items.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="هنوز سفارشی ندارید"
            description="پس از ثبت سفارش، وضعیت و جزئیات تحویل آن از همین بخش قابل پیگیری است."
            action={
              <Link href="/products">
                <Button>مشاهده محصولات</Button>
              </Link>
            }
          />
        ) : null}
        {!orders.isPending && orders.data && orders.data.items.length > 0 ? (
          <div className="space-y-3">
            {orders.data.items.map((order) => (
              <Link
                key={order.id}
                href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}
                className="block rounded-3xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-200"
              >
                <Card className="rounded-3xl shadow-none transition hover:border-zinc-300 hover:shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-zinc-950">
                            {order.orderNumber}
                          </p>
                          <Badge tone={orderStatusTone(order.status)}>
                            {orderStatusLabel(order.status)}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-zinc-600">
                          {formatOrderDate(order.createdAt)} ·{" "}
                          {new Intl.NumberFormat("fa-IR").format(
                            order.itemCount,
                          )}{" "}
                          قلم کالا
                        </p>
                      </div>
                      <div className="sm:text-left">
                        <p className="font-black text-zinc-950">
                          {formatOrderMoney(order.grandTotalRials)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5 sm:justify-end">
                          <Badge tone={paymentStatusTone(order.paymentStatus)}>
                            {paymentStatusLabel(order.paymentStatus)}
                          </Badge>
                          <Badge
                            tone={fulfillmentStatusTone(
                              order.fulfillmentStatus,
                            )}
                          >
                            {fulfillmentStatusLabel(order.fulfillmentStatus)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-4 text-sm font-semibold text-zinc-700">
                      مشاهده جزئیات و پیگیری{" "}
                      <ArrowLeft className="size-4" aria-hidden="true" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : null}
        {orders.data ? (
          <OrderPager
            page={orders.data.page}
            totalPages={orders.data.totalPages}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      <Card className="mt-8 rounded-3xl border-dashed bg-zinc-50/60 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="size-4 text-zinc-500" aria-hidden="true" />
            پیگیری امن سفارش
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-7 text-zinc-600">
            جزئیات داخلی عملیات، اطلاعات سایر مشتریان، شناسه‌های کامل دستگاه و
            داده‌های حساس پرداخت در این ناحیه نمایش داده نمی‌شوند.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
