import { z } from "zod";

import {
  MAX_ORDER_MONEY_RIALS,
  ORDER_ACTOR_TYPES,
  ORDER_ALLOCATION_STATUSES,
  ORDER_FULFILLMENT_METHODS,
  ORDER_FULFILLMENT_STATUSES,
  ORDER_NOTE_VISIBILITIES,
  ORDER_PAYMENT_METHODS,
  ORDER_PAYMENT_STATUSES,
  ORDER_SOURCES,
  ORDER_STATUSES,
  ORDER_TYPES,
} from "./types";

const cuid = z.string().cuid();
const boundedText = (max: number) => z.string().trim().min(1).max(max);
const optionalNullableText = (max: number) =>
  boundedText(max).nullable().optional();
const idempotencyKey = z
  .string()
  .trim()
  .min(8)
  .max(160)
  .regex(/^[A-Za-z0-9._:-]+$/);
const orderNumber = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{5,63}$/);
const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/);

/** A JSON-safe non-negative signed-64-bit minor-unit amount. */
export const orderMoneyRialsInput = z
  .union([
    z
      .string()
      .trim()
      .max(19)
      .regex(/^(?:0|[1-9]\d*)$/),
    z.bigint().nonnegative().max(MAX_ORDER_MONEY_RIALS),
  ])
  .transform((value, context) => {
    try {
      const amount = typeof value === "bigint" ? value : BigInt(value);
      if (amount > MAX_ORDER_MONEY_RIALS) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Money amount exceeds the signed 64-bit persistence range.",
        });
        return z.NEVER;
      }
      return amount;
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Money must be a non-negative decimal integer.",
      });
      return z.NEVER;
    }
  });

export const orderSourceInput = z.enum(ORDER_SOURCES);
export const orderTypeInput = z.enum(ORDER_TYPES);
export const orderStatusInput = z.enum(ORDER_STATUSES);
export const orderPaymentStatusInput = z.enum(ORDER_PAYMENT_STATUSES);
export const orderAllocationStatusInput = z.enum(ORDER_ALLOCATION_STATUSES);
export const orderFulfillmentStatusInput = z.enum(ORDER_FULFILLMENT_STATUSES);
export const orderFulfillmentMethodInput = z.enum(ORDER_FULFILLMENT_METHODS);
export const orderPaymentMethodInput = z.enum(ORDER_PAYMENT_METHODS);
export const orderNoteVisibilityInput = z.enum(ORDER_NOTE_VISIBILITIES);
export const orderActorTypeInput = z.enum(ORDER_ACTOR_TYPES);

export const orderIdRouteInput = z.object({ id: cuid }).strict();
export const orderNumberRouteInput = z.object({ orderNumber }).strict();

export const orderItemRequestInput = z
  .object({
    variantId: cuid,
    quantity: z.number().int().min(1).max(1_000),
  })
  .strict();

const checkoutFulfillmentShape = {
  fulfillmentMethod: orderFulfillmentMethodInput,
  pickupBranchId: cuid.optional(),
  shippingAddressId: cuid.optional(),
  billingAddressId: cuid.optional(),
};

function validateCheckoutFulfillment(
  value: z.output<z.ZodObject<typeof checkoutFulfillmentShape>>,
  context: z.RefinementCtx,
): void {
  if (value.fulfillmentMethod === "PICKUP") {
    if (value.pickupBranchId === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pickupBranchId"],
        message: "A pickup branch is required for pickup orders.",
      });
    }
    if (value.shippingAddressId !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shippingAddressId"],
        message: "Shipping addresses are not accepted for pickup orders.",
      });
    }
  }
  if (value.fulfillmentMethod === "DELIVERY") {
    if (value.shippingAddressId === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shippingAddressId"],
        message: "A shipping address is required for delivery orders.",
      });
    }
    if (value.pickupBranchId !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pickupBranchId"],
        message: "Pickup branches are not accepted for delivery orders.",
      });
    }
  }
}

const checkoutFulfillmentFields = z.object(checkoutFulfillmentShape).strict();

/**
 * Public checkout input intentionally has no price, tax, discount or total.
 * The order service loads the cart and performs pricing from server snapshots.
 */
export const createOrderFromCartInput = checkoutFulfillmentFields
  .extend({
    idempotencyKey,
  })
  .strict()
  .superRefine(validateCheckoutFulfillment);

export const createOrderInput = createOrderFromCartInput;

/** Admin and POS entry also omit money fields; pricing remains server-authoritative. */
export const createAdminOrderInput = checkoutFulfillmentFields
  .extend({
    customerId: cuid,
    source: z
      .enum(["ADMIN", "BRANCH_POS", "CALL_CENTER", "IMPORT", "API"])
      .default("ADMIN"),
    type: orderTypeInput.default("STANDARD_SALE"),
    items: z
      .array(orderItemRequestInput)
      .min(1)
      .max(100)
      .superRefine((items, context) => {
        const variantIds = items.map((item) => item.variantId);
        if (new Set(variantIds).size !== variantIds.length) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Each variant may appear at most once in an order request.",
          });
        }
      }),
    idempotencyKey,
  })
  .strict()
  .superRefine(validateCheckoutFulfillment);

export const transitionOrderStatusInput = z
  .object({
    toStatus: orderStatusInput,
    expectedVersion: z.number().int().min(1),
    reasonCode: boundedText(80).optional(),
    note: optionalNullableText(1_000),
    idempotencyKey,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.toStatus === "CANCELLED" || value.toStatus === "REJECTED") &&
      value.reasonCode === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reasonCode"],
        message: "A reasonCode is required for cancellation or rejection.",
      });
    }
  });

export const cancelOrderInput = z
  .object({
    expectedVersion: z.number().int().min(1),
    reasonCode: boundedText(80),
    note: optionalNullableText(1_000),
    idempotencyKey,
  })
  .strict();

export const confirmOrderInput = z
  .object({
    expectedVersion: z.number().int().min(1),
    idempotencyKey,
  })
  .strict();

/**
 * Allocation is explicitly retriable after an expired or failed reservation.
 * Prices, quantities and SKU references always come from the immutable order
 * snapshot; the caller may only constrain the operational branch target.
 */
export const allocateOrderInput = z
  .object({
    branchId: cuid.optional(),
    expectedVersion: z.number().int().min(1),
    idempotencyKey,
  })
  .strict();

export const createOrderNoteInput = z
  .object({
    visibility: orderNoteVisibilityInput.default("INTERNAL"),
    content: boundedText(4_000),
    idempotencyKey,
  })
  .strict();

/**
 * Payment amount and status are deliberately absent. They are derived by the
 * payment orchestration service from the persisted order snapshot.
 */
export const createOrderPaymentAttemptInput = z
  .object({
    method: orderPaymentMethodInput,
    provider: boundedText(80),
    idempotencyKey,
  })
  .strict();

export const createOrderFulfillmentInput = z
  .object({
    method: orderFulfillmentMethodInput,
    branchId: cuid.optional(),
    warehouseId: cuid.optional(),
    status: z
      .enum([
        "PENDING",
        "PICKING",
        "PACKED",
        "READY_FOR_PICKUP",
        "SHIPPED",
        "DELIVERED",
      ])
      .default("PENDING"),
    trackingCode: optionalNullableText(160),
    expectedVersion: z.number().int().min(1),
    idempotencyKey,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.method === "PICKUP" && value.branchId === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["branchId"],
        message: "Pickup fulfillment requires a branch.",
      });
    }
  });

export const recordOrderPaymentInput = z
  .object({
    provider: boundedText(80),
    method: orderPaymentMethodInput,
    providerReference: optionalNullableText(160),
    expectedVersion: z.number().int().min(1),
    idempotencyKey,
  })
  .strict();

export const orderListQuery = z
  .object({
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    query: boundedText(160).optional(),
    customerId: cuid.optional(),
    branchId: cuid.optional(),
    source: orderSourceInput.optional(),
    status: orderStatusInput.optional(),
    paymentStatus: orderPaymentStatusInput.optional(),
    allocationStatus: orderAllocationStatusInput.optional(),
    fulfillmentStatus: orderFulfillmentStatusInput.optional(),
    createdFrom: z.coerce.date().optional(),
    createdTo: z.coerce.date().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.createdFrom !== undefined &&
      value.createdTo !== undefined &&
      value.createdFrom > value.createdTo
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["createdTo"],
        message: "createdTo must not be before createdFrom.",
      });
    }
  });

export const orderPricingRequestInput = z
  .object({
    currency,
    lines: z
      .array(
        z
          .object({
            quantity: z.number().int().min(1).max(1_000_000),
            unitPriceRials: orderMoneyRialsInput,
            discountAmountRials: orderMoneyRialsInput.optional(),
            taxAmountRials: orderMoneyRialsInput.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    discountTotalRials: orderMoneyRialsInput.optional(),
    taxTotalRials: orderMoneyRialsInput.optional(),
    shippingTotalRials: orderMoneyRialsInput.optional(),
    feeTotalRials: orderMoneyRialsInput.optional(),
  })
  .strict();

export type OrderMoneyRialsInput = z.output<typeof orderMoneyRialsInput>;
export type OrderItemRequestInput = z.output<typeof orderItemRequestInput>;
export type CreateOrderFromCartInput = z.output<
  typeof createOrderFromCartInput
>;
export type CreateOrderInput = z.output<typeof createOrderInput>;
export type CreateAdminOrderInput = z.output<typeof createAdminOrderInput>;
export type TransitionOrderStatusInput = z.output<
  typeof transitionOrderStatusInput
>;
export type CancelOrderInput = z.output<typeof cancelOrderInput>;
export type ConfirmOrderInput = z.output<typeof confirmOrderInput>;
export type AllocateOrderInput = z.output<typeof allocateOrderInput>;
export type CreateOrderNoteInput = z.output<typeof createOrderNoteInput>;
export type CreateOrderPaymentAttemptInput = z.output<
  typeof createOrderPaymentAttemptInput
>;
export type CreateOrderFulfillmentInput = z.output<
  typeof createOrderFulfillmentInput
>;
export type RecordOrderPaymentInput = z.output<typeof recordOrderPaymentInput>;
export type OrderListQuery = z.output<typeof orderListQuery>;
export type OrderPricingRequestInput = z.output<
  typeof orderPricingRequestInput
>;
