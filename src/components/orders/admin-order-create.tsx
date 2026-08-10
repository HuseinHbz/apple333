"use client";

import { useMutation } from "@tanstack/react-query";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { adminApiRequest } from "@/modules/admin/api-client";

import {
  createOrderRequestIdempotencyKey,
  orderRequestErrorMessage,
  type OrderDetail,
} from "./order-ui";

type DraftLine = Readonly<{ key: string; variantId: string; quantity: string }>;

function newLine(): DraftLine {
  return {
    key: createOrderRequestIdempotencyKey(),
    variantId: "",
    quantity: "1",
  };
}

export function AdminOrderCreate() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [source, setSource] = useState<"ADMIN" | "BRANCH_POS" | "CALL_CENTER">(
    "ADMIN",
  );
  const [fulfillmentMethod, setFulfillmentMethod] = useState<
    "PICKUP" | "DELIVERY"
  >("DELIVERY");
  const [pickupBranchId, setPickupBranchId] = useState("");
  const [shippingAddressId, setShippingAddressId] = useState("");
  const [billingAddressId, setBillingAddressId] = useState("");
  const [lines, setLines] = useState<readonly DraftLine[]>([newLine()]);

  const create = useMutation({
    mutationFn: () => {
      const idempotencyKey = createOrderRequestIdempotencyKey();
      return adminApiRequest<OrderDetail>("/api/admin/orders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          customerId: customerId.trim(),
          source,
          type: "STANDARD_SALE",
          fulfillmentMethod,
          ...(fulfillmentMethod === "PICKUP"
            ? { pickupBranchId: pickupBranchId.trim() }
            : { shippingAddressId: shippingAddressId.trim() }),
          ...(billingAddressId.trim()
            ? { billingAddressId: billingAddressId.trim() }
            : {}),
          items: lines.map((line) => ({
            variantId: line.variantId.trim(),
            quantity: Number(line.quantity),
          })),
          idempotencyKey,
        }),
      });
    },
    onSuccess: (order) =>
      router.push(`/admin/orders/${encodeURIComponent(order.id)}`),
  });

  const updateLine = (
    key: string,
    updates: Partial<Omit<DraftLine, "key">>,
  ) => {
    setLines((current) =>
      current.map((line) =>
        line.key === key ? { ...line, ...updates } : line,
      ),
    );
  };

  const removeLine = (key: string) => {
    setLines((current) =>
      current.length === 1
        ? current
        : current.filter((line) => line.key !== key),
    );
  };

  const submitDisabled =
    create.isPending ||
    !customerId.trim() ||
    lines.some(
      (line) =>
        !line.variantId.trim() ||
        !Number.isInteger(Number(line.quantity)) ||
        Number(line.quantity) < 1,
    ) ||
    (fulfillmentMethod === "PICKUP"
      ? !pickupBranchId.trim()
      : !shippingAddressId.trim());

  return (
    <form
      className="space-y-5"
      data-testid="admin-order-create"
      onSubmit={(event) => {
        event.preventDefault();
        if (!submitDisabled) create.mutate();
      }}
    >
      <Alert title="مبالغ در این فرم وارد نمی‌شوند" tone="info">
        <p>
          قیمت، تخفیف، مالیات و مبلغ نهایی فقط در سرویس سفارش از داده‌های معتبر
          کاتالوگ محاسبه و ذخیره می‌شوند.
        </p>
      </Alert>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-3xl shadow-none">
          <CardHeader>
            <CardTitle>مشتری و منبع ثبت</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block text-sm font-medium text-zinc-800">
              شناسه مشتری
              <Input
                className="mt-2"
                dir="ltr"
                minLength={1}
                required
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                placeholder="cuid مشتری"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-800">
              منبع ثبت سفارش
              <Select
                className="mt-2"
                value={source}
                onChange={(event) =>
                  setSource(event.target.value as typeof source)
                }
              >
                <option value="ADMIN">ثبت مدیریتی</option>
                <option value="BRANCH_POS">فروش شعبه</option>
                <option value="CALL_CENTER">مرکز تماس</option>
              </Select>
            </label>
            <p className="text-xs leading-5 text-zinc-500">
              شناسه‌ها در سمت سرور با اعتبارسنجی Zod و مجوز شعبه بررسی می‌شوند؛
              این فرم هیچ مجوزی را دور نمی‌زند.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-none">
          <CardHeader>
            <CardTitle>روش تحویل</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block text-sm font-medium text-zinc-800">
              روش دریافت
              <Select
                className="mt-2"
                value={fulfillmentMethod}
                onChange={(event) =>
                  setFulfillmentMethod(
                    event.target.value as typeof fulfillmentMethod,
                  )
                }
              >
                <option value="DELIVERY">ارسال به نشانی</option>
                <option value="PICKUP">تحویل حضوری</option>
              </Select>
            </label>
            {fulfillmentMethod === "PICKUP" ? (
              <label className="block text-sm font-medium text-zinc-800">
                شناسه شعبه تحویل
                <Input
                  className="mt-2"
                  dir="ltr"
                  required
                  value={pickupBranchId}
                  onChange={(event) => setPickupBranchId(event.target.value)}
                  placeholder="cuid شعبه"
                />
              </label>
            ) : (
              <label className="block text-sm font-medium text-zinc-800">
                شناسه نشانی ارسال
                <Input
                  className="mt-2"
                  dir="ltr"
                  required
                  value={shippingAddressId}
                  onChange={(event) => setShippingAddressId(event.target.value)}
                  placeholder="cuid نشانی مشتری"
                />
              </label>
            )}
            <label className="block text-sm font-medium text-zinc-800">
              شناسه نشانی صورتحساب{" "}
              <span className="font-normal text-zinc-500">(اختیاری)</span>
              <Input
                className="mt-2"
                dir="ltr"
                value={billingAddressId}
                onChange={(event) => setBillingAddressId(event.target.value)}
                placeholder="cuid نشانی"
              />
            </label>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl shadow-none">
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center">
          <div>
            <CardTitle>اقلام سفارش</CardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              هر کالا یک‌بار وارد می‌شود و موجودی آن در مرحله ثبت سمت سرور رزرو
              خواهد شد.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setLines((current) => [...current, newLine()])}
          >
            <Plus className="size-4" aria-hidden="true" />
            افزودن کالا
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((line, index) => (
            <div
              key={line.key}
              className="grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end"
            >
              <label className="block text-sm font-medium text-zinc-800">
                شناسه مدل {new Intl.NumberFormat("fa-IR").format(index + 1)}
                <Input
                  className="mt-2 bg-white"
                  dir="ltr"
                  required
                  value={line.variantId}
                  onChange={(event) =>
                    updateLine(line.key, { variantId: event.target.value })
                  }
                  placeholder="cuid مدل"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-800">
                تعداد
                <Input
                  className="mt-2 bg-white"
                  min={1}
                  required
                  type="number"
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(line.key, { quantity: event.target.value })
                  }
                />
              </label>
              <Button
                aria-label={`حذف کالای ${index + 1}`}
                disabled={lines.length === 1}
                size="sm"
                variant="ghost"
                onClick={() => removeLine(line.key)}
              >
                <Minus className="size-4" aria-hidden="true" />
                حذف
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {create.error ? (
        <Alert title="ثبت سفارش انجام نشد" tone="danger">
          <p>{orderRequestErrorMessage(create.error)}</p>
        </Alert>
      ) : null}

      <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-xs leading-5 text-zinc-500">
          با ثبت، وضعیت، تخصیص، رزرو و رویدادهای ممیزی در یک مرز تراکنشی سمت
          سرور بررسی می‌شوند.
        </p>
        <Button size="lg" type="submit" disabled={submitDisabled}>
          <ShoppingBag className="size-4" aria-hidden="true" />
          {create.isPending ? "در حال ثبت سفارش…" : "ثبت سفارش"}
        </Button>
      </div>
    </form>
  );
}
