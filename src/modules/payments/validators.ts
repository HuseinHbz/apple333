import { z } from "zod";

import { PAYMENT_SIMULATOR_SCENARIOS } from "./types";

const identifier = z.string().trim().min(8).max(200);
const idempotencyKey = z
  .string()
  .trim()
  .min(16)
  .max(160)
  .regex(/^[A-Za-z0-9._:-]+$/);
const moneyString = z
  .string()
  .regex(/^[1-9][0-9]{0,18}$/)
  .refine((value) => BigInt(value) <= 9_223_372_036_854_775_807n, {
    message: "Amount exceeds PostgreSQL bigint range.",
  });

export const paymentIdRouteInput = z.object({ id: identifier });
export const orderPaymentRouteInput = z.object({ orderNumber: identifier });
export const paymentProviderRouteInput = z.object({
  provider: z.enum(["PAYMENT_SIMULATOR"]),
});

export const createPaymentInput = z
  .object({
    idempotencyKey,
    provider: z.literal("PAYMENT_SIMULATOR").default("PAYMENT_SIMULATOR"),
  })
  .strict();

export const initializePaymentInput = z
  .object({
    idempotencyKey,
    scenario: z.enum(PAYMENT_SIMULATOR_SCENARIOS).default("success"),
    returnUrl: z.string().url().max(2_000),
  })
  .strict();

export const verifyPaymentInput = z
  .object({
    idempotencyKey,
    authority: identifier.optional(),
  })
  .strict();

export const paymentCallbackInput = z
  .object({
    externalEventId: identifier,
    authority: identifier,
    signature: z.string().regex(/^[0-9a-fA-F]{64}$/),
    scenario: z.enum(PAYMENT_SIMULATOR_SCENARIOS).default("success"),
  })
  .strict();

export const createRefundInput = z
  .object({
    idempotencyKey,
    amountRials: moneyString,
    reason: z.string().trim().min(8).max(500),
    scenario: z
      .enum(["refund_success", "refund_failure"])
      .default("refund_success"),
  })
  .strict();

export const paymentListQuery = z
  .object({
    query: z.string().trim().max(200).optional(),
    provider: z.literal("PAYMENT_SIMULATOR").optional(),
    status: z
      .enum([
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
      ])
      .optional(),
    providerReference: z.string().trim().max(200).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    minAmountRials: moneyString.optional(),
    maxAmountRials: moneyString.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .superRefine((input, context) => {
    if (input.from && input.to && input.from > input.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "End date must not precede start date.",
      });
    }
    if (
      input.minAmountRials &&
      input.maxAmountRials &&
      BigInt(input.minAmountRials) > BigInt(input.maxAmountRials)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxAmountRials"],
        message: "Maximum amount must not be below minimum amount.",
      });
    }
  });

export const reconcilePaymentInput = z
  .object({
    idempotencyKey,
  })
  .strict();

export type CreatePaymentInput = z.output<typeof createPaymentInput>;
export type InitializePaymentInput = z.output<typeof initializePaymentInput>;
export type VerifyPaymentInput = z.output<typeof verifyPaymentInput>;
export type PaymentCallbackInput = z.output<typeof paymentCallbackInput>;
export type CreateRefundInput = z.output<typeof createRefundInput>;
export type PaymentListQuery = z.output<typeof paymentListQuery>;
export type ReconcilePaymentInput = z.output<typeof reconcilePaymentInput>;
