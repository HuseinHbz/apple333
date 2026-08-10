import type {
  OrderPaymentStatus,
  OrderStatus,
  OrderStatusTransition,
  OrderStatusTransitionRequest,
  OrderTransitionContext,
  OrderTransitionEffect,
} from "./types";

export class OrderStateTransitionError extends Error {
  public constructor(
    public readonly code:
      | "INVALID_TRANSITION"
      | "MISSING_REASON"
      | "UNMET_PRECONDITION",
    message: string,
  ) {
    super(message);
    this.name = "OrderStateTransitionError";
  }
}

export type OrderTransitionEvaluation = Readonly<{
  allowed: boolean;
  violations: readonly string[];
  effects: readonly OrderTransitionEffect[];
}>;

/**
 * The graph is intentionally conservative. Route handlers and UI components
 * must ask the domain service to evaluate a transition instead of mutating a
 * status column directly.
 */
export const ORDER_STATUS_TRANSITIONS: Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  DRAFT: ["PENDING_CONFIRMATION", "CANCELLED", "REJECTED"],
  PENDING_CONFIRMATION: ["CONFIRMED", "CANCELLED", "REJECTED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

function hasReason(reasonCode: string | undefined): boolean {
  return typeof reasonCode === "string" && reasonCode.trim().length > 0;
}

function normalizedReason(reasonCode: string | undefined): string | null {
  const normalized = reasonCode?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function isPaidOrPartiallyPaid(
  status: OrderPaymentStatus | undefined,
): boolean {
  return (
    status === "PAID" ||
    status === "PARTIALLY_PAID" ||
    status === "PARTIALLY_REFUNDED"
  );
}

function commonEffects(): OrderTransitionEffect[] {
  return ["WRITE_STATUS_HISTORY", "WRITE_AUDIT_RECORD", "WRITE_OUTBOX_EVENT"];
}

/**
 * Effects are a durable-work checklist for the application service. The
 * state-machine itself performs no I/O and therefore remains unit-testable.
 */
export function getOrderTransitionEffects(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  context: OrderTransitionContext = {},
): readonly OrderTransitionEffect[] {
  const effects = commonEffects();

  if (toStatus === "CANCELLED") {
    effects.unshift(
      "RELEASE_INVENTORY_RESERVATIONS",
      "CANCEL_PENDING_PAYMENT_ATTEMPTS",
    );
    if (fromStatus === "CONFIRMED" || fromStatus === "PROCESSING") {
      effects.splice(1, 0, "REVERSE_INVENTORY_ALLOCATION");
    }
    if (isPaidOrPartiallyPaid(context.paymentStatus)) {
      effects.splice(0, 0, "CREATE_REFUND_REQUIRED_EVENT");
    }
  }

  return effects;
}

export function getAllowedOrderStatusTransitions(
  status: OrderStatus,
): readonly OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[status];
}

export function canTransitionOrderStatus(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
): boolean {
  return ORDER_STATUS_TRANSITIONS[fromStatus].includes(toStatus);
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[status].length === 0;
}

export function isCancellationTransition(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
): boolean {
  return toStatus === "CANCELLED" && fromStatus !== "CANCELLED";
}

function evaluatePreconditions(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  context: OrderTransitionContext,
  reasonCode: string | undefined,
): string[] {
  const violations: string[] = [];

  if (
    (toStatus === "CANCELLED" || toStatus === "REJECTED") &&
    !hasReason(reasonCode)
  ) {
    violations.push("A reasonCode is required for cancellation or rejection.");
  }

  if (fromStatus === "DRAFT" && toStatus === "PENDING_CONFIRMATION") {
    if (context.itemCount === undefined || context.itemCount < 1) {
      violations.push("A pending order must contain at least one valid item.");
    }
    if (context.totalsCalculatedServerSide !== true) {
      violations.push(
        "Order totals must be calculated server-side before confirmation is requested.",
      );
    }
    if (context.customerSnapshotValid !== true) {
      violations.push(
        "A valid customer snapshot is required before confirmation is requested.",
      );
    }
  }

  if (fromStatus === "PENDING_CONFIRMATION" && toStatus === "CONFIRMED") {
    if (context.reservationActive !== true) {
      violations.push(
        "An active inventory reservation is required before confirmation.",
      );
    }
    if (context.allocationStatus !== "ALLOCATED") {
      violations.push(
        "A successful full allocation is required before confirmation.",
      );
    }
    if (context.paymentPolicyAllowsConfirmation !== true) {
      violations.push("The payment policy does not permit confirmation.");
    }
  }

  if (
    fromStatus === "CONFIRMED" &&
    toStatus === "PROCESSING" &&
    context.allocationValid !== true
  ) {
    violations.push(
      "A valid inventory allocation is required before processing.",
    );
  }

  if (fromStatus === "PROCESSING" && toStatus === "COMPLETED") {
    const pickedUp =
      context.fulfillmentMethod === "PICKUP" &&
      context.pickupCollected === true;
    if (context.fulfillmentStatus !== "DELIVERED" && !pickedUp) {
      violations.push(
        "The order must be delivered or collected before completion.",
      );
    }
    if (context.paymentStatus !== "PAID") {
      violations.push(
        "The required payment must be completed before order completion.",
      );
    }
  }

  if (toStatus === "CANCELLED") {
    if (context.cancellationAllowed === false) {
      violations.push("Cancellation is not authorized for this order.");
    }
    if (
      context.fulfillmentStatus === "SHIPPED" ||
      context.fulfillmentStatus === "DELIVERED"
    ) {
      violations.push(
        "A shipped or delivered order cannot be cancelled by this workflow.",
      );
    }
  }

  return violations;
}

export function evaluateOrderStatusTransition(
  request: OrderStatusTransitionRequest,
): OrderTransitionEvaluation {
  const context = request.context ?? {};
  const effects = getOrderTransitionEffects(
    request.fromStatus,
    request.toStatus,
    context,
  );

  if (!canTransitionOrderStatus(request.fromStatus, request.toStatus)) {
    return {
      allowed: false,
      violations: [
        `${request.fromStatus} cannot transition to ${request.toStatus}.`,
      ],
      effects,
    };
  }

  const violations = evaluatePreconditions(
    request.fromStatus,
    request.toStatus,
    context,
    request.reasonCode,
  );
  return { allowed: violations.length === 0, violations, effects };
}

/**
 * Fail closed when a lifecycle precondition is absent. The application layer
 * should persist the returned transition, effects, status history, and audit
 * record together in one transaction.
 */
export function assertOrderStatusTransition(
  request: OrderStatusTransitionRequest,
): OrderStatusTransition {
  const evaluation = evaluateOrderStatusTransition(request);
  if (!evaluation.allowed) {
    const firstViolation =
      evaluation.violations[0] ?? "Order transition precondition failed.";
    const code = canTransitionOrderStatus(request.fromStatus, request.toStatus)
      ? firstViolation.startsWith("A reasonCode")
        ? "MISSING_REASON"
        : "UNMET_PRECONDITION"
      : "INVALID_TRANSITION";
    throw new OrderStateTransitionError(code, firstViolation);
  }

  return {
    fromStatus: request.fromStatus,
    toStatus: request.toStatus,
    reasonCode: normalizedReason(request.reasonCode),
    effects: evaluation.effects,
  };
}
