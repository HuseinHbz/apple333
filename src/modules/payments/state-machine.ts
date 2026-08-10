import type { PaymentStatus, PaymentTransition } from "./types";

export class PaymentStateTransitionError extends Error {
  public readonly code = "PAYMENT_INVALID_TRANSITION";

  public constructor(from: PaymentStatus, to: PaymentStatus) {
    super(`Payment cannot transition from ${from} to ${to}.`);
    this.name = "PaymentStateTransitionError";
  }
}

export const PAYMENT_STATUS_TRANSITIONS: Readonly<
  Record<PaymentStatus, readonly PaymentStatus[]>
> = {
  CREATED: ["INITIALIZING", "CANCELLED"],
  INITIALIZING: ["PENDING", "PAID", "FAILED", "CANCELLED", "EXPIRED"],
  PENDING: ["AUTHORIZED", "PAID", "FAILED", "CANCELLED", "EXPIRED"],
  AUTHORIZED: ["PAID", "FAILED", "CANCELLED", "EXPIRED"],
  PAID: ["PARTIALLY_REFUNDED", "REFUNDED"],
  FAILED: ["INITIALIZING", "CANCELLED"],
  CANCELLED: [],
  EXPIRED: ["INITIALIZING", "CANCELLED"],
  PARTIALLY_REFUNDED: ["REFUNDED"],
  REFUNDED: [],
};

const eventByStatus: Readonly<Record<PaymentStatus, string>> = {
  CREATED: "payment.created",
  INITIALIZING: "payment.initializing",
  PENDING: "payment.pending",
  AUTHORIZED: "payment.authorized",
  PAID: "payment.paid",
  FAILED: "payment.failed",
  CANCELLED: "payment.cancelled",
  EXPIRED: "payment.expired",
  PARTIALLY_REFUNDED: "payment.partially_refunded",
  REFUNDED: "payment.refunded",
};

export function canTransitionPayment(
  from: PaymentStatus,
  to: PaymentStatus,
): boolean {
  return PAYMENT_STATUS_TRANSITIONS[from].includes(to);
}

export function assertPaymentTransition(
  from: PaymentStatus,
  to: PaymentStatus,
): PaymentTransition {
  if (!canTransitionPayment(from, to)) {
    throw new PaymentStateTransitionError(from, to);
  }
  return { from, to, eventType: eventByStatus[to] };
}

export function isPaymentTerminal(status: PaymentStatus): boolean {
  return PAYMENT_STATUS_TRANSITIONS[status].length === 0;
}
