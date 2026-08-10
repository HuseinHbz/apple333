/** Phase 08 payment contracts. Money is always bigint in the domain. */
export const PAYMENT_STATUSES = [
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
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_PROVIDERS = ["PAYMENT_SIMULATOR"] as const;
export type PaymentProviderCode = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_SIMULATOR_SCENARIOS = [
  "success",
  "cancelled",
  "declined",
  "expired",
  "timeout",
  "duplicate_callback",
  "callback_before_redirect",
  "redirect_before_callback",
  "invalid_signature",
  "wrong_amount",
  "unknown_authority",
  "network_retry",
  "refund_success",
  "refund_failure",
] as const;

export type PaymentSimulatorScenario =
  (typeof PAYMENT_SIMULATOR_SCENARIOS)[number];

export type PaymentTransactionDto = Readonly<{
  id: string;
  type: string;
  amountRials: string | null;
  status: string;
  providerReference: string | null;
  providerCode: string | null;
  occurredAt: string;
}>;

export type PaymentAttemptDto = Readonly<{
  id: string;
  attemptNumber: number;
  provider: string;
  amountRials: string | null;
  currency: string;
  status: string;
  redirectUrl: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  createdAt: string;
}>;

export type RefundDto = Readonly<{
  id: string;
  amountRials: string | null;
  reason: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}>;

export type PaymentDto = Readonly<{
  id: string;
  orderId: string;
  orderNumber: string;
  paymentNumber: string;
  currency: string;
  amountRials: string | null;
  status: PaymentStatus;
  method: string;
  provider: string;
  version: number;
  paidAt: string | null;
  expiresAt: string | null;
  attempts: readonly PaymentAttemptDto[];
  transactions: readonly PaymentTransactionDto[];
  refunds: readonly RefundDto[];
  createdAt: string;
  updatedAt: string;
}>;

export type PaymentTransition = Readonly<{
  from: PaymentStatus;
  to: PaymentStatus;
  eventType: string;
}>;
