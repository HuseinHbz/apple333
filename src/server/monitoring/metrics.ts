import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from "prom-client";

type CheckStatus = "ok" | "disabled" | "unavailable";

type ReadinessSnapshot = {
  ready: boolean;
  checks: {
    configuration: CheckStatus;
    database: CheckStatus;
    orders: CheckStatus;
    redis: CheckStatus;
  };
};

type MetricsStore = {
  dependencyUp: Gauge<"dependency">;
  readinessUp: Gauge;
  readinessDuration: Histogram<"route">;
  orderCommands: Counter<"operation" | "result">;
  orderCommandDuration: Histogram<"operation">;
  ordersCreated: Counter;
  ordersConfirmed: Counter;
  ordersCancelled: Counter;
  ordersCompleted: Counter;
  orderAllocationFailures: Counter;
  orderReservationFailures: Counter;
  orderVersionConflicts: Counter;
  orderIdempotencyReplays: Counter;
  paymentCommands: Counter<"operation" | "result">;
  paymentCommandDuration: Histogram<"operation">;
  paymentVerificationDuration: Histogram;
  paymentsCreated: Counter;
  paymentInitializations: Counter;
  paymentSuccess: Counter;
  paymentFailure: Counter;
  paymentCallbacks: Counter<"result">;
  paymentCallbackDuplicates: Counter;
  paymentAmountMismatches: Counter;
  paymentReconciliationMismatches: Counter;
  refundRequests: Counter;
  refundSuccess: Counter;
  registry: Registry;
};

const metricsGlobal = globalThis as typeof globalThis & {
  __apple333MetricsStore?: MetricsStore;
};

function metricsStore(): MetricsStore {
  if (metricsGlobal.__apple333MetricsStore) {
    return metricsGlobal.__apple333MetricsStore;
  }

  const registry = new Registry();
  collectDefaultMetrics({ prefix: "apple333_process_", register: registry });

  const store: MetricsStore = {
    registry,
    readinessUp: new Gauge({
      name: "apple333_readiness_up",
      help: "Whether Apple333 is ready to receive application traffic.",
      registers: [registry],
    }),
    dependencyUp: new Gauge({
      name: "apple333_dependency_up",
      help: "Latest dependency readiness result, where 1 is healthy and 0 is unavailable or disabled.",
      labelNames: ["dependency"],
      registers: [registry],
    }),
    readinessDuration: new Histogram({
      name: "apple333_readiness_duration_seconds",
      help: "Duration of the readiness dependency probe.",
      labelNames: ["route"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [registry],
    }),
    orderCommands: new Counter({
      name: "apple333_order_commands_total",
      help: "Completed order-management commands by operation and result.",
      labelNames: ["operation", "result"],
      registers: [registry],
    }),
    orderCommandDuration: new Histogram({
      name: "apple333_order_command_duration_seconds",
      help: "Duration of completed order-management commands.",
      labelNames: ["operation"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [registry],
    }),
    ordersCreated: new Counter({
      name: "apple333_orders_created_total",
      help: "Successfully created orders.",
      registers: [registry],
    }),
    ordersConfirmed: new Counter({
      name: "apple333_orders_confirmed_total",
      help: "Successfully confirmed orders.",
      registers: [registry],
    }),
    ordersCancelled: new Counter({
      name: "apple333_orders_cancelled_total",
      help: "Successfully cancelled orders.",
      registers: [registry],
    }),
    ordersCompleted: new Counter({
      name: "apple333_orders_completed_total",
      help: "Successfully completed orders.",
      registers: [registry],
    }),
    orderAllocationFailures: new Counter({
      name: "apple333_order_allocation_failures_total",
      help: "Order allocation command failures.",
      registers: [registry],
    }),
    orderReservationFailures: new Counter({
      name: "apple333_order_reservation_failures_total",
      help: "Order reservation command failures.",
      registers: [registry],
    }),
    orderVersionConflicts: new Counter({
      name: "apple333_order_version_conflicts_total",
      help: "Order optimistic-lock conflicts.",
      registers: [registry],
    }),
    orderIdempotencyReplays: new Counter({
      name: "apple333_order_idempotency_replays_total",
      help: "Order command idempotency replays.",
      registers: [registry],
    }),
    paymentCommands: new Counter({
      name: "apple333_payment_commands_total",
      help: "Completed payment commands by bounded operation and result labels.",
      labelNames: ["operation", "result"],
      registers: [registry],
    }),
    paymentCommandDuration: new Histogram({
      name: "apple333_payment_command_duration_seconds",
      help: "Internal payment command duration excluding external gateway latency where measured separately.",
      labelNames: ["operation"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [registry],
    }),
    paymentVerificationDuration: new Histogram({
      name: "apple333_payment_verification_duration_ms",
      help: "Server-side payment verification duration in milliseconds.",
      buckets: [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000],
      registers: [registry],
    }),
    paymentsCreated: new Counter({
      name: "apple333_payments_created_total",
      help: "Canonical payments created.",
      registers: [registry],
    }),
    paymentInitializations: new Counter({
      name: "apple333_payment_initializations_total",
      help: "Successful provider initializations.",
      registers: [registry],
    }),
    paymentSuccess: new Counter({
      name: "apple333_payment_success_total",
      help: "Server-verified successful payments.",
      registers: [registry],
    }),
    paymentFailure: new Counter({
      name: "apple333_payment_failure_total",
      help: "Failed payment commands.",
      registers: [registry],
    }),
    paymentCallbacks: new Counter({
      name: "apple333_payment_callback_total",
      help: "Payment callbacks by canonical processing result.",
      labelNames: ["result"],
      registers: [registry],
    }),
    paymentCallbackDuplicates: new Counter({
      name: "apple333_payment_callback_duplicate_total",
      help: "Idempotently rejected duplicate callbacks.",
      registers: [registry],
    }),
    paymentAmountMismatches: new Counter({
      name: "apple333_payment_amount_mismatch_total",
      help: "Provider responses rejected due to money mismatch.",
      registers: [registry],
    }),
    paymentReconciliationMismatches: new Counter({
      name: "apple333_payment_reconciliation_mismatch_total",
      help: "Payment reconciliation mismatches.",
      registers: [registry],
    }),
    refundRequests: new Counter({
      name: "apple333_refund_requests_total",
      help: "Controlled refund requests.",
      registers: [registry],
    }),
    refundSuccess: new Counter({
      name: "apple333_refund_success_total",
      help: "Provider-confirmed refunds.",
      registers: [registry],
    }),
  };

  metricsGlobal.__apple333MetricsStore = store;
  return store;
}

function up(status: CheckStatus): number {
  return status === "ok" ? 1 : 0;
}

export function recordReadiness(
  snapshot: ReadinessSnapshot,
  durationMs: number,
): void {
  const store = metricsStore();
  store.readinessUp.set(snapshot.ready ? 1 : 0);
  store.dependencyUp.set(
    { dependency: "configuration" },
    up(snapshot.checks.configuration),
  );
  store.dependencyUp.set(
    { dependency: "database" },
    up(snapshot.checks.database),
  );
  store.dependencyUp.set({ dependency: "orders" }, up(snapshot.checks.orders));
  store.dependencyUp.set({ dependency: "redis" }, up(snapshot.checks.redis));
  store.readinessDuration.observe({ route: "/api/ready" }, durationMs / 1_000);
}

export type OrderMetricOperation =
  | "create"
  | "confirm"
  | "cancel"
  | "allocate"
  | "fulfillment"
  | "payment"
  | "note";
export type OrderMetricResult = "success" | "failure" | "replay";

/** Records only bounded operation labels; no order/customer identifiers enter Prometheus. */
export function recordOrderCommand(
  operation: OrderMetricOperation,
  result: OrderMetricResult,
  durationMs: number,
  errorCode?: string,
): void {
  const store = metricsStore();
  store.orderCommands.inc({ operation, result });
  store.orderCommandDuration.observe(
    { operation },
    Math.max(durationMs, 0) / 1_000,
  );
  if (result === "replay") store.orderIdempotencyReplays.inc();
  if (result !== "failure") return;
  if (
    errorCode === "ORDER_ALLOCATION_FAILED" ||
    errorCode === "ORDER_INVENTORY_UNAVAILABLE"
  )
    store.orderAllocationFailures.inc();
  if (errorCode === "ORDER_RESERVATION_FAILED")
    store.orderReservationFailures.inc();
  if (errorCode === "ORDER_VERSION_CONFLICT") store.orderVersionConflicts.inc();
}

export function recordOrderLifecycleEvent(
  event: "created" | "confirmed" | "cancelled" | "completed",
): void {
  const store = metricsStore();
  if (event === "created") store.ordersCreated.inc();
  if (event === "confirmed") store.ordersConfirmed.inc();
  if (event === "cancelled") store.ordersCancelled.inc();
  if (event === "completed") store.ordersCompleted.inc();
}

export type PaymentMetricOperation =
  | "create"
  | "initialize"
  | "verify"
  | "callback"
  | "reconcile"
  | "refund";
export type PaymentMetricResult = "success" | "failure" | "replay";

export function recordPaymentCommand(
  operation: PaymentMetricOperation,
  result: PaymentMetricResult,
  durationMs: number,
): void {
  const store = metricsStore();
  store.paymentCommands.inc({ operation, result });
  store.paymentCommandDuration.observe(
    { operation },
    Math.max(durationMs, 0) / 1_000,
  );
  if (operation === "verify") {
    store.paymentVerificationDuration.observe(Math.max(durationMs, 0));
  }
  if (result === "failure") store.paymentFailure.inc();
}

export function recordPaymentCallback(
  result: "success" | "failure" | "duplicate" | "invalid",
  durationMs: number,
): void {
  const store = metricsStore();
  store.paymentCallbacks.inc({ result });
  store.paymentCommandDuration.observe(
    { operation: "callback" },
    Math.max(durationMs, 0) / 1_000,
  );
  if (result === "duplicate") store.paymentCallbackDuplicates.inc();
  if (result === "failure" || result === "invalid") store.paymentFailure.inc();
}

export function recordPaymentLifecycle(
  event:
    | "created"
    | "initialized"
    | "paid"
    | "failed"
    | "amount_mismatch"
    | "reconciled"
    | "reconciliation_mismatch"
    | "refund_requested"
    | "refunded",
): void {
  const store = metricsStore();
  if (event === "created") store.paymentsCreated.inc();
  if (event === "initialized") store.paymentInitializations.inc();
  if (event === "paid") store.paymentSuccess.inc();
  if (event === "failed") store.paymentFailure.inc();
  if (event === "amount_mismatch") store.paymentAmountMismatches.inc();
  if (event === "reconciliation_mismatch")
    store.paymentReconciliationMismatches.inc();
  if (event === "refund_requested") store.refundRequests.inc();
  if (event === "refunded") store.refundSuccess.inc();
}

export function metricsContentType(): string {
  return metricsStore().registry.contentType;
}

export function collectMetrics(): Promise<string> {
  return metricsStore().registry.metrics();
}
