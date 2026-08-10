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

export function metricsContentType(): string {
  return metricsStore().registry.contentType;
}

export function collectMetrics(): Promise<string> {
  return metricsStore().registry.metrics();
}
