"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Plus, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useDebouncedValue } from "@/components/admin/admin-resource-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApiRequest } from "@/modules/admin/api-client";

import {
  allocationStatusLabel,
  allocationStatusTone,
  formatOrderDate,
  formatOrderMoney,
  fulfillmentStatusLabel,
  fulfillmentStatusTone,
  orderQueryString,
  orderRequestErrorMessage,
  orderSourceLabel,
  orderStatusLabel,
  orderStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
  type OrderListItem,
  type OrderPage,
} from "./order-ui";

interface AdminOrderListProps {
  permissions: readonly string[];
}

function Pagination({
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
      aria-label="صفحه‌بندی سفارش‌ها"
      className="flex items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3"
    >
      <p className="text-xs text-zinc-500">
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
          صفحه قبل
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          صفحه بعد
        </Button>
      </div>
    </nav>
  );
}

export function AdminOrderList({ permissions }: AdminOrderListProps) {
  const permissionSet = new Set(permissions);
  const canCreate = permissionSet.has("orders.create_admin");
  const canViewFinancials = permissionSet.has("orders.view_financials");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [branchId, setBranchId] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [fulfillmentStatus, setFulfillmentStatus] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim());

  const path = `/api/admin/orders${orderQueryString({
    page,
    pageSize: 25,
    query: debouncedQuery || undefined,
    branchId: branchId.trim() || undefined,
    source: source || undefined,
    status: status || undefined,
    paymentStatus: paymentStatus || undefined,
    fulfillmentStatus: fulfillmentStatus || undefined,
    createdFrom: createdFrom ? `${createdFrom}T00:00:00.000Z` : undefined,
    createdTo: createdTo ? `${createdTo}T23:59:59.999Z` : undefined,
  })}`;

  const orders = useQuery({
    queryKey: ["admin", "orders", path],
    queryFn: () => adminApiRequest<OrderPage<OrderListItem>>(path),
    staleTime: 10_000,
  });

  const resetPage = (update: () => void) => {
    update();
    setPage(1);
  };

  const columns: readonly DataTableColumn<OrderListItem>[] = [
    {
      id: "order",
      header: "سفارش",
      cell: (order) => (
        <div className="min-w-40">
          <Link
            className="font-semibold text-zinc-950 underline-offset-4 hover:underline"
            href={`/admin/orders/${encodeURIComponent(order.id)}`}
          >
            {order.orderNumber}
          </Link>
          <p className="mt-1 text-xs text-zinc-500">
            {orderSourceLabel(order.source)} ·{" "}
            {formatOrderDate(order.createdAt)}
          </p>
        </div>
      ),
    },
    {
      id: "customer",
      header: "مشتری",
      cell: (order) => (
        <div className="min-w-36">
          <p className="font-medium text-zinc-800">
            {order.customerName ?? "مشتری مهمان"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {order.branchName ?? "بدون تخصیص شعبه"}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: "وضعیت سفارش",
      cell: (order) => (
        <Badge tone={orderStatusTone(order.status)}>
          {orderStatusLabel(order.status)}
        </Badge>
      ),
    },
    {
      id: "payment",
      header: "پرداخت",
      cell: (order) => (
        <Badge tone={paymentStatusTone(order.paymentStatus)}>
          {paymentStatusLabel(order.paymentStatus)}
        </Badge>
      ),
    },
    {
      id: "fulfillment",
      header: "تحویل",
      cell: (order) => (
        <div className="space-y-1">
          <Badge tone={fulfillmentStatusTone(order.fulfillmentStatus)}>
            {fulfillmentStatusLabel(order.fulfillmentStatus)}
          </Badge>
          <p className="text-xs text-zinc-500">
            {allocationStatusLabel(order.allocationStatus)}
          </p>
        </div>
      ),
    },
    {
      id: "items",
      header: "اقلام",
      cell: (order) => new Intl.NumberFormat("fa-IR").format(order.itemCount),
    },
    ...(canViewFinancials
      ? [
          {
            id: "total",
            header: "مبلغ",
            cell: (order: OrderListItem) => (
              <span className="whitespace-nowrap font-semibold text-zinc-950">
                {formatOrderMoney(order.grandTotalRials)}
              </span>
            ),
          } satisfies DataTableColumn<OrderListItem>,
        ]
      : []),
  ];

  const list = orders.data;

  return (
    <div className="space-y-5" data-testid="admin-order-list">
      <Card className="rounded-3xl shadow-none">
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center">
          <div>
            <CardTitle>جست‌وجو و فیلتر سفارش‌ها</CardTitle>
            <p className="mt-1 text-sm leading-6 text-zinc-500">
              نتایج به‌صورت پایدار و صفحه‌بندی‌شده از سرویس مدیریت سفارش دریافت
              می‌شوند.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              aria-label="به‌روزرسانی فهرست سفارش‌ها"
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
            {canCreate ? (
              <Link href="/admin/orders/create">
                <Button size="sm">
                  <Plus className="size-4" aria-hidden="true" />
                  ثبت سفارش
                </Button>
              </Link>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="md:col-span-2 xl:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-zinc-700">
                شماره سفارش یا مشتری
              </span>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
                  aria-hidden="true"
                />
                <Input
                  className="pr-9"
                  value={query}
                  onChange={(event) =>
                    resetPage(() => setQuery(event.target.value))
                  }
                  placeholder="شماره سفارش، نام، ایمیل یا موبایل"
                />
              </div>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-zinc-700">
                وضعیت سفارش
              </span>
              <Select
                value={status}
                onChange={(event) =>
                  resetPage(() => setStatus(event.target.value))
                }
              >
                <option value="">همه وضعیت‌ها</option>
                <option value="DRAFT">پیش‌نویس</option>
                <option value="PENDING_CONFIRMATION">در انتظار تأیید</option>
                <option value="CONFIRMED">تأیید شده</option>
                <option value="PROCESSING">در حال آماده‌سازی</option>
                <option value="COMPLETED">تکمیل شده</option>
                <option value="CANCELLED">لغو شده</option>
                <option value="REJECTED">رد شده</option>
              </Select>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-zinc-700">
                وضعیت پرداخت
              </span>
              <Select
                value={paymentStatus}
                onChange={(event) =>
                  resetPage(() => setPaymentStatus(event.target.value))
                }
              >
                <option value="">همه وضعیت‌ها</option>
                <option value="UNPAID">پرداخت نشده</option>
                <option value="PENDING">در انتظار پرداخت</option>
                <option value="PAID">پرداخت شده</option>
                <option value="FAILED">ناموفق</option>
                <option value="REFUNDED">بازپرداخت شده</option>
              </Select>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-zinc-700">
                وضعیت تحویل
              </span>
              <Select
                value={fulfillmentStatus}
                onChange={(event) =>
                  resetPage(() => setFulfillmentStatus(event.target.value))
                }
              >
                <option value="">همه وضعیت‌ها</option>
                <option value="UNFULFILLED">آماده‌سازی نشده</option>
                <option value="PICKING">در حال جمع‌آوری</option>
                <option value="READY_FOR_PICKUP">آماده تحویل حضوری</option>
                <option value="SHIPPED">ارسال شده</option>
                <option value="DELIVERED">تحویل شده</option>
                <option value="FAILED">ناموفق</option>
              </Select>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-zinc-700">
                منبع ثبت
              </span>
              <Select
                value={source}
                onChange={(event) =>
                  resetPage(() => setSource(event.target.value))
                }
              >
                <option value="">همه منابع</option>
                <option value="STOREFRONT">فروشگاه آنلاین</option>
                <option value="ADMIN">ثبت مدیریتی</option>
                <option value="BRANCH_POS">فروش شعبه</option>
                <option value="CALL_CENTER">مرکز تماس</option>
              </Select>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-zinc-700">
                شناسه شعبه
              </span>
              <Input
                dir="ltr"
                value={branchId}
                onChange={(event) =>
                  resetPage(() => setBranchId(event.target.value))
                }
                placeholder="cuid"
              />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-zinc-700">
                از تاریخ
              </span>
              <Input
                type="date"
                value={createdFrom}
                onChange={(event) =>
                  resetPage(() => setCreatedFrom(event.target.value))
                }
              />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-zinc-700">
                تا تاریخ
              </span>
              <Input
                type="date"
                value={createdTo}
                onChange={(event) =>
                  resetPage(() => setCreatedTo(event.target.value))
                }
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {orders.isError ? (
        <Alert title="فهرست سفارش‌ها دریافت نشد" tone="danger">
          <p>{orderRequestErrorMessage(orders.error)}</p>
        </Alert>
      ) : null}

      {orders.isPending ? (
        <div
          className="space-y-3"
          role="status"
          aria-live="polite"
          aria-label="در حال دریافت سفارش‌ها"
        >
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : null}

      {!orders.isPending && list?.items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="سفارشی پیدا نشد"
          description="برای این معیارها سفارشی ثبت نشده است یا هنوز سفارش قابل مشاهده‌ای ندارید."
          action={
            canCreate ? (
              <Link href="/admin/orders/create">
                <Button>ثبت سفارش جدید</Button>
              </Link>
            ) : undefined
          }
        />
      ) : null}

      {!orders.isPending && list && list.items.length > 0 ? (
        <Card className="overflow-hidden rounded-3xl shadow-none">
          <CardHeader>
            <div>
              <CardTitle>فهرست سفارش‌ها</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                {new Intl.NumberFormat("fa-IR").format(list.total)} سفارش مطابق
                فیلترهای فعلی
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              getRowKey={(order) => order.id}
              rows={list.items}
            />
          </CardContent>
          <Pagination
            page={list.page}
            totalPages={list.totalPages}
            onPageChange={setPage}
          />
        </Card>
      ) : null}
    </div>
  );
}
