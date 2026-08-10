/**
 * Phase 07 order-domain contracts.
 *
 * Money values remain bigint inside the domain and are serialized as decimal
 * strings at the API boundary. This prevents floating-point arithmetic from
 * entering the order aggregate.
 */

export const ORDER_SOURCES = [
  "STOREFRONT",
  "ADMIN",
  "BRANCH_POS",
  "CALL_CENTER",
  "IMPORT",
  "API",
] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const ORDER_TYPES = [
  "STANDARD_SALE",
  "PICKUP",
  "DELIVERY",
  "RESERVATION",
  "PREORDER",
  "INSTALLMENT_PLACEHOLDER",
  "TRADE_IN_PLACEHOLDER",
] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_STATUSES = [
  "DRAFT",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_PAYMENT_STATUSES = [
  "UNPAID",
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "PARTIALLY_PAID",
  "FAILED",
  "CANCELLED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[number];

export const ORDER_ALLOCATION_STATUSES = [
  "UNALLOCATED",
  "PARTIALLY_ALLOCATED",
  "ALLOCATED",
  "ALLOCATION_FAILED",
  "RELEASED",
] as const;
export type OrderAllocationStatus = (typeof ORDER_ALLOCATION_STATUSES)[number];

export const ORDER_FULFILLMENT_STATUSES = [
  "UNFULFILLED",
  "PENDING",
  "PICKING",
  "PACKED",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "PARTIALLY_FULFILLED",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
] as const;
export type OrderFulfillmentStatus =
  (typeof ORDER_FULFILLMENT_STATUSES)[number];

/** Reservation terms deliberately match the order integration contract, not a storage provider. */
export const ORDER_RESERVATION_STATUSES = [
  "PENDING",
  "ACTIVE",
  "CONSUMED",
  "RELEASED",
  "EXPIRED",
  "FAILED",
] as const;
export type OrderReservationStatus =
  (typeof ORDER_RESERVATION_STATUSES)[number];

export const ORDER_FULFILLMENT_METHODS = ["PICKUP", "DELIVERY"] as const;
export type OrderFulfillmentMethod = (typeof ORDER_FULFILLMENT_METHODS)[number];

export const ORDER_NOTE_VISIBILITIES = ["INTERNAL", "CUSTOMER"] as const;
export type OrderNoteVisibility = (typeof ORDER_NOTE_VISIBILITIES)[number];

export const ORDER_ACTOR_TYPES = [
  "CUSTOMER",
  "ADMIN",
  "GUEST",
  "SYSTEM",
] as const;
export type OrderActorType = (typeof ORDER_ACTOR_TYPES)[number];

export const ORDER_PAYMENT_METHODS = [
  "ONLINE",
  "CASH",
  "CARD_ON_DELIVERY",
  "BANK_TRANSFER",
  "WALLET",
  "INSTALLMENT",
] as const;
export type OrderPaymentMethod = (typeof ORDER_PAYMENT_METHODS)[number];

/** A signed PostgreSQL bigint cannot represent a larger persisted money value. */
export const MAX_ORDER_MONEY_RIALS = 9_223_372_036_854_775_807n;

export type OrderMoney = bigint;

export type OrderCustomerSnapshot = Readonly<{
  /** Guest orders preserve the commercial snapshot without a User id. */
  id: string | null;
  name: string | null;
  email: string | null;
  mobile: string | null;
}>;

export type OrderAddressSnapshot = Readonly<{
  recipientName: string;
  mobile: string;
  province: string | null;
  city: string | null;
  line1: string;
  postalCode: string | null;
}>;

export type OrderWarrantySnapshot = Readonly<{
  code: string | null;
  provider: string | null;
  name: string | null;
  durationMonths: number | null;
}>;

export type OrderItemCommercialSnapshot = Readonly<{
  productId: string;
  variantId: string;
  sku: string;
  productName: string;
  variantName: string | null;
  warranty: OrderWarrantySnapshot | null;
  attributes: Readonly<Record<string, unknown>>;
}>;

export type OrderItemPricingInput = Readonly<{
  quantity: number;
  unitPriceRials: OrderMoney;
  discountAmountRials?: OrderMoney;
  taxAmountRials?: OrderMoney;
}>;

export type OrderCalculatedLine = Readonly<{
  quantity: number;
  unitPriceRials: OrderMoney;
  subtotalRials: OrderMoney;
  discountAmountRials: OrderMoney;
  taxAmountRials: OrderMoney;
  lineTotalRials: OrderMoney;
}>;

/** Input only available to server-side pricing and snapshot construction. */
export type OrderPricingInput = Readonly<{
  currency: string;
  lines: readonly OrderItemPricingInput[];
  discountTotalRials?: OrderMoney;
  taxTotalRials?: OrderMoney;
  shippingTotalRials?: OrderMoney;
  feeTotalRials?: OrderMoney;
}>;

export type OrderPricingSummary = Readonly<{
  currency: string;
  lines: readonly OrderCalculatedLine[];
  subtotalRials: OrderMoney;
  discountTotalRials: OrderMoney;
  taxTotalRials: OrderMoney;
  shippingTotalRials: OrderMoney;
  feeTotalRials: OrderMoney;
  grandTotalRials: OrderMoney;
}>;

export type OrderPricingSummaryDto = Readonly<{
  currency: string;
  subtotalRials: string;
  discountTotalRials: string;
  taxTotalRials: string;
  shippingTotalRials: string;
  feeTotalRials: string;
  grandTotalRials: string;
}>;

export type OrderItemDto = Readonly<{
  id: string;
  snapshot: OrderItemCommercialSnapshot;
  quantity: number;
  /** Null when the caller does not have financial-order visibility. */
  unitPriceRials: string | null;
  /** Null when the caller does not have financial-order visibility. */
  discountAmountRials: string | null;
  /** Null when the caller does not have financial-order visibility. */
  taxAmountRials: string | null;
  /** Null when the caller does not have financial-order visibility. */
  lineTotalRials: string | null;
}>;

export type OrderStatusHistoryDto = Readonly<{
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorId: string | null;
  actorType: OrderActorType;
  reasonCode: string | null;
  note: string | null;
  createdAt: string;
}>;

export type OrderDto = Readonly<{
  id: string;
  orderNumber: string;
  source: OrderSource;
  type: OrderType;
  customerId: string | null;
  customer: OrderCustomerSnapshot;
  billingAddress: OrderAddressSnapshot | null;
  shippingAddress: OrderAddressSnapshot | null;
  fulfillmentMethod: OrderFulfillmentMethod;
  /** Null when the caller does not have financial-order visibility. */
  pricing: OrderPricingSummaryDto | null;
  paymentStatus: OrderPaymentStatus;
  allocationStatus: OrderAllocationStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
  status: OrderStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}>;

export type OrderTransitionContext = Readonly<{
  itemCount?: number;
  totalsCalculatedServerSide?: boolean;
  customerSnapshotValid?: boolean;
  reservationActive?: boolean;
  allocationStatus?: OrderAllocationStatus;
  allocationValid?: boolean;
  paymentPolicyAllowsConfirmation?: boolean;
  paymentStatus?: OrderPaymentStatus;
  fulfillmentStatus?: OrderFulfillmentStatus;
  fulfillmentMethod?: OrderFulfillmentMethod;
  pickupCollected?: boolean;
  cancellationAllowed?: boolean;
}>;

export type OrderStatusTransitionRequest = Readonly<{
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  reasonCode?: string;
  context?: OrderTransitionContext;
}>;

export type OrderTransitionEffect =
  | "RELEASE_INVENTORY_RESERVATIONS"
  | "REVERSE_INVENTORY_ALLOCATION"
  | "CANCEL_PENDING_PAYMENT_ATTEMPTS"
  | "CREATE_REFUND_REQUIRED_EVENT"
  | "WRITE_STATUS_HISTORY"
  | "WRITE_AUDIT_RECORD"
  | "WRITE_OUTBOX_EVENT";

export type OrderStatusTransition = Readonly<{
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  reasonCode: string | null;
  effects: readonly OrderTransitionEffect[];
}>;
