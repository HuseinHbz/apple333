import type {
  OrderDto,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderStatus,
} from "@/modules/orders/types";

export type OrderPage<T> = Readonly<{
  items: readonly T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}>;

/** Public list shape returned by the planned customer/admin list endpoints. */
export type OrderListItem = Readonly<{
  id: string;
  orderNumber: string;
  source: string;
  type: string;
  customerName: string | null;
  branchName: string | null;
  itemCount: number;
  grandTotalRials: string | null;
  paymentStatus: string;
  allocationStatus: string;
  fulfillmentStatus: string;
  status: string;
  version: number;
  createdAt: string;
}>;

/**
 * UI-only API projection. It intentionally contains no raw Prisma model and
 * no full IMEI/serial value; the API remains responsible for field-level
 * authorization before this projection is returned to the browser.
 */
export type OrderDetail = OrderDto &
  Readonly<{
    items: readonly Readonly<{
      id: string;
      snapshot: Readonly<{
        productId: string;
        variantId: string;
        sku: string;
        productName: string;
        variantName: string | null;
        warranty: Readonly<{
          code: string | null;
          provider: string | null;
          name: string | null;
          durationMonths: number | null;
        }> | null;
        attributes: Readonly<Record<string, unknown>>;
      }>;
      quantity: number;
      unitPriceRials: string | null;
      discountAmountRials: string | null;
      taxAmountRials: string | null;
      lineTotalRials: string | null;
    }>[];
    timeline: readonly Readonly<{
      id: string;
      fromStatus: OrderStatus | null;
      toStatus: OrderStatus;
      actorId: string | null;
      actorType: string;
      reasonCode: string | null;
      note: string | null;
      createdAt: string;
    }>[];
    fulfillment: Readonly<{
      method: "PICKUP" | "DELIVERY";
      status: string;
      trackingCode: string | null;
      branch: Readonly<{ id: string; code: string; name: string }> | null;
      warehouse: Readonly<{ id: string; code: string; name: string }> | null;
      preparedAt: string | null;
      shippedAt: string | null;
      deliveredAt: string | null;
    }> | null;
    allocations: readonly Readonly<{
      id: string;
      orderItemId: string;
      branch: Readonly<{ id: string; code: string; name: string }>;
      warehouse: Readonly<{ id: string; code: string; name: string }>;
      quantity: number;
      status: string;
      reservationStatus: string | null;
      deviceUnits: readonly Readonly<{
        id: string;
        imei: string | null;
        serialNumber: string | null;
        status: string;
      }>[];
    }>[];
    notes: readonly Readonly<{
      id: string;
      visibility: string;
      content: string;
      authorName: string | null;
      createdAt: string;
    }>[];
    payments: readonly Readonly<{
      id: string;
      provider: string;
      method: string;
      amountRials: string;
      status: string;
      providerReference: string | null;
      createdAt: string;
    }>[];
  }>;

export type OrderTone = "neutral" | "success" | "warning" | "danger" | "info";

const orderStatusLabels: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  PENDING_CONFIRMATION: "در انتظار تأیید",
  CONFIRMED: "تأیید شده",
  PROCESSING: "در حال آماده‌سازی",
  COMPLETED: "تکمیل شده",
  CANCELLED: "لغو شده",
  REJECTED: "رد شده",
};

const paymentStatusLabels: Record<string, string> = {
  UNPAID: "پرداخت نشده",
  PENDING: "در انتظار پرداخت",
  AUTHORIZED: "مجوز پرداخت دریافت شد",
  PAID: "پرداخت شده",
  PARTIALLY_PAID: "بخشی پرداخت شده",
  FAILED: "پرداخت ناموفق",
  CANCELLED: "پرداخت لغو شده",
  PARTIALLY_REFUNDED: "بخشی بازپرداخت شده",
  REFUNDED: "بازپرداخت شده",
};

const fulfillmentStatusLabels: Record<string, string> = {
  UNFULFILLED: "آماده‌سازی نشده",
  PENDING: "در صف آماده‌سازی",
  PICKING: "در حال جمع‌آوری",
  PACKED: "بسته‌بندی شده",
  READY_FOR_PICKUP: "آماده تحویل حضوری",
  SHIPPED: "ارسال شده",
  PARTIALLY_FULFILLED: "بخشی تحویل شده",
  DELIVERED: "تحویل شده",
  FAILED: "تحویل ناموفق",
  CANCELLED: "ارسال لغو شده",
};

const allocationStatusLabels: Record<string, string> = {
  UNALLOCATED: "تخصیص داده نشده",
  PARTIALLY_ALLOCATED: "تخصیص ناقص",
  ALLOCATED: "تخصیص داده شده",
  ALLOCATION_FAILED: "تخصیص ناموفق",
  RELEASED: "آزاد شده",
};

const orderSourceLabels: Record<string, string> = {
  STOREFRONT: "فروشگاه آنلاین",
  ADMIN: "ثبت مدیریتی",
  BRANCH_POS: "فروش شعبه",
  CALL_CENTER: "مرکز تماس",
  IMPORT: "ورود داده",
  API: "رابط برنامه‌نویسی",
};

export function formatOrderMoney(value: string | null): string {
  if (value === null) return "مبلغ محرمانه";
  try {
    return `${new Intl.NumberFormat("fa-IR").format(BigInt(value))} ریال`;
  } catch {
    return "مبلغ در دسترس نیست";
  }
}

export function formatOrderDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function orderStatusLabel(status: string): string {
  return orderStatusLabels[status] ?? status;
}

export function paymentStatusLabel(status: string): string {
  return paymentStatusLabels[status] ?? status;
}

export function fulfillmentStatusLabel(status: string): string {
  return fulfillmentStatusLabels[status] ?? status;
}

export function allocationStatusLabel(status: string): string {
  return allocationStatusLabels[status] ?? status;
}

export function orderSourceLabel(source: string): string {
  return orderSourceLabels[source] ?? source;
}

export function orderStatusTone(status: string): OrderTone {
  if (status === "COMPLETED" || status === "CONFIRMED") return "success";
  if (status === "PENDING_CONFIRMATION" || status === "PROCESSING")
    return "warning";
  if (status === "CANCELLED" || status === "REJECTED") return "danger";
  if (status === "DRAFT") return "neutral";
  return "info";
}

export function paymentStatusTone(status: string): OrderTone {
  if (status === "PAID") return "success";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (
    status === "PENDING" ||
    status === "PARTIALLY_PAID" ||
    status === "AUTHORIZED"
  )
    return "warning";
  return "neutral";
}

export function fulfillmentStatusTone(status: string): OrderTone {
  if (status === "DELIVERED" || status === "READY_FOR_PICKUP") return "success";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (
    status === "PICKING" ||
    status === "PACKED" ||
    status === "SHIPPED" ||
    status === "PENDING"
  )
    return "warning";
  return "neutral";
}

export function allocationStatusTone(status: string): OrderTone {
  if (status === "ALLOCATED") return "success";
  if (status === "ALLOCATION_FAILED") return "danger";
  if (status === "PARTIALLY_ALLOCATED") return "warning";
  return "neutral";
}

export function orderStatusChangeLabel(
  fromStatus: string | null,
  toStatus: string,
): string {
  return fromStatus
    ? `${orderStatusLabel(fromStatus)} ← ${orderStatusLabel(toStatus)}`
    : orderStatusLabel(toStatus);
}

export function orderRequestErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    ORDER_ACCESS_DENIED: "شما به این سفارش دسترسی ندارید.",
    ORDER_NOT_FOUND: "سفارش موردنظر پیدا نشد.",
    ORDER_CANCELLATION_NOT_ALLOWED: "لغو این سفارش در وضعیت فعلی ممکن نیست.",
    ORDER_INVALID_TRANSITION: "تغییر وضعیت انتخاب‌شده مجاز نیست.",
    ORDER_VERSION_CONFLICT:
      "این سفارش هم‌زمان تغییر کرده است. اطلاعات را تازه کنید.",
    ORDER_INVENTORY_UNAVAILABLE: "موجودی لازم برای این سفارش در دسترس نیست.",
    ORDER_ALLOCATION_FAILED: "تخصیص موجودی انجام نشد.",
    ORDER_PRICE_CHANGED: "قیمت یا وضعیت یکی از کالاها تغییر کرده است.",
    ORDER_IDEMPOTENCY_CONFLICT:
      "این درخواست پیش‌تر با اطلاعات متفاوت ثبت شده است.",
  };
  return messages[code] ?? "عملیات سفارش انجام نشد. لطفاً دوباره تلاش کنید.";
}

export function orderQueryString(
  values: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function createOrderRequestIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();
  return `order-ui-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function canCancelCustomerOrder(status: OrderStatus): boolean {
  return status === "PENDING_CONFIRMATION";
}

export function isUnpaidPayment(status: OrderPaymentStatus): boolean {
  return status === "UNPAID" || status === "PENDING" || status === "FAILED";
}

export function isUnfulfilled(status: OrderFulfillmentStatus): boolean {
  return status === "UNFULFILLED" || status === "PENDING";
}
