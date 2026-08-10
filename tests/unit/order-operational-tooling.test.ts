import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ORDER_BENCHMARK_SCALES,
  ORDER_BENCHMARK_P95_TARGETS_MS,
  ORDER_BENCHMARK_SQL_QUERIES,
  createOrderBenchmarkReport,
  findOrderBenchmarkP95Failures,
  orderBenchmarkDatasetDistribution,
  orderBenchmarkLifecycle,
  parseOrderBenchmarkArguments,
  validateOrderBenchmarkEnvironment,
} from "../../scripts/benchmark-orders.mjs";
import { parsePhase07CleanupArguments } from "../../scripts/cleanup-phase07-test-environment.mjs";
import {
  parseOrderReconciliationArguments,
  reconcileOrderRecords,
} from "../../scripts/reconcile-orders.mjs";
import { orderEvidenceMetadata } from "../../scripts/write-order-evidence-metadata.mjs";

const testDatabaseUrl =
  "postgresql://apple333_phase07_order_test:local-test-password@127.0.0.1:55434/apple333_phase07_order_test?schema=public";

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    APPLE333_TEST_DB: "1",
    APPLE333_ORDER_TEST_DB: "1",
    ORDER_TEST_DATABASE_URL: testDatabaseUrl,
    ORDER_BENCHMARK_ALLOW_SEED: "1",
    ORDER_BENCHMARK_RUN_ID: "phase07-unit-run",
  };
}

describe("Phase 07 operational tooling", () => {
  it("accepts only explicit supported benchmark scales", () => {
    expect(ORDER_BENCHMARK_SCALES).toEqual([10_000, 100_000]);
    expect(
      parseOrderBenchmarkArguments(["--execute", "--scale", "10000"]),
    ).toEqual({ help: false, scale: 10_000 });
    expect(() =>
      parseOrderBenchmarkArguments(["--execute", "--scale", "5000"]),
    ).toThrow("--scale must be exactly 10000 or 100000.");
  });

  it("casts raw SQL enum parameters without casting the indexed column", () => {
    expect(ORDER_BENCHMARK_SQL_QUERIES.adminOrderList).toContain(
      '$1::"OrderStatus"',
    );
    expect(ORDER_BENCHMARK_SQL_QUERIES.adminOrderList).not.toContain(
      '"orderStatus"::text',
    );
  });

  it("requires a guarded test target and an explicit unique benchmark acknowledgement", () => {
    expect(validateOrderBenchmarkEnvironment(validEnvironment())).toEqual({
      ok: true,
      errors: [],
    });
    const missingAcknowledgements = validateOrderBenchmarkEnvironment({
      ...validEnvironment(),
      ORDER_BENCHMARK_ALLOW_SEED: undefined,
      ORDER_BENCHMARK_RUN_ID: "unsafe",
    });
    expect(missingAcknowledgements).toEqual(
      expect.objectContaining({ ok: false }),
    );
    expect(missingAcknowledgements.errors).toEqual(
      expect.arrayContaining([
        'ORDER_BENCHMARK_ALLOW_SEED must be exactly "1".',
        "ORDER_BENCHMARK_RUN_ID must be 8-40 lowercase letters, digits, or hyphens.",
      ]),
    );
  });

  it("creates a lifecycle-complete realistic distribution across four branches", () => {
    const distribution = orderBenchmarkDatasetDistribution(100);

    expect(distribution).toMatchObject({
      orders: 100,
      branches: 4,
      syntheticCustomers: 24,
      orderStatuses: {
        COMPLETED: 28,
        CONFIRMED: 20,
        PROCESSING: 15,
        PENDING_CONFIRMATION: 17,
        CANCELLED: 15,
        REJECTED: 5,
      },
    });
    expect(
      Object.values(distribution.branchLoad).map((branch) => branch.orders),
    ).toEqual([25, 25, 25, 25]);
    expect(
      Object.values(distribution.branchLoad).map(
        (branch) => branch.activeReservations,
      ),
    ).toEqual([13, 13, 13, 13]);
    expect(orderBenchmarkLifecycle(1)).toMatchObject({
      orderStatus: "COMPLETED",
      reservationStatus: "FULFILLED",
    });
    expect(orderBenchmarkLifecycle(96)).toMatchObject({
      orderStatus: "REJECTED",
      allocationStatus: "ALLOCATION_FAILED",
    });
  });

  it("fails closed when a required read or write p95 metric is missing or exceeds its target", () => {
    const passingMetrics = Object.fromEntries(
      Object.entries(ORDER_BENCHMARK_P95_TARGETS_MS).map(([name, targetMs]) => [
        name,
        { p95Ms: targetMs - 1 },
      ]),
    );

    expect(findOrderBenchmarkP95Failures(passingMetrics)).toEqual([]);
    expect(
      findOrderBenchmarkP95Failures({
        ...passingMetrics,
        createOrder: { p95Ms: 501 },
        confirmOrder: undefined,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "createOrder",
          targetMs: 500,
          actualMs: 501,
          reason: "p95_exceeded",
        }),
        expect.objectContaining({
          name: "confirmOrder",
          targetMs: 500,
          actualMs: null,
          reason: "missing_metric",
        }),
      ]),
    );
  });

  it("emits a sanitized benchmark report with read, SQL, create, and confirm evidence", () => {
    const metrics = Object.fromEntries(
      Object.entries(ORDER_BENCHMARK_P95_TARGETS_MS).map(([name, targetMs]) => [
        name,
        { p95Ms: targetMs - 1 },
      ]),
    );
    const report = createOrderBenchmarkReport({
      scale: 10_000,
      marker: "phase07-order-benchmark:unit-test",
      samples: 30,
      seedDurationMs: 123.456,
      distribution: orderBenchmarkDatasetDistribution(100),
      metrics,
      sqlMetrics: {
        adminOrderList: { p95Ms: 10 },
        customerOrderList: { p95Ms: 10 },
        branchOrderList: { p95Ms: 10 },
        orderNumberSearch: { p95Ms: 10 },
      },
      plans: { adminOrderList: { rootNode: "Index Scan" } },
      actionOperations: { createOrder: 31, confirmOrder: 31 },
    });

    expect(report.passed).toBe(true);
    expect(report.measurement.scope).toContain("excluding external payment");
    expect(report.metrics).toHaveProperty("createOrder");
    expect(report.metrics).toHaveProperty("confirmOrder");
    expect(report.sql.p95Metrics).toHaveProperty("adminOrderList");
    expect(JSON.stringify(report)).not.toContain("local-test-password");
    expect(JSON.stringify(report)).not.toContain("postgresql://");
  });

  it("keeps executable benchmark and cleanup package commands argument-transparent", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(manifest.scripts["order:benchmark"]).toBe(
      "node scripts/benchmark-orders.mjs",
    );
    expect(manifest.scripts["order:test:cleanup"]).toBe(
      "node scripts/cleanup-phase07-test-environment.mjs",
    );
    expect(parsePhase07CleanupArguments(["node", "cleanup"])).toEqual({
      destroyOwned: false,
    });
    expect(
      parsePhase07CleanupArguments(["node", "cleanup", "--destroy-owned"]),
    ).toEqual({ destroyOwned: true });
  });

  it("passes workflow arguments through pnpm without injecting an extra separator", () => {
    const workflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/phase07-order-evidence.yml"),
      "utf8",
    );

    expect(workflow).not.toContain(" -- --");
    expect(workflow).toContain("pnpm order:benchmark --execute --scale 10000");
    expect(workflow).toContain("pnpm order:benchmark --execute --scale 100000");
    expect(workflow).toContain("pnpm order:reconcile --json");
  });

  it("recognizes a coherent completed order without exposing or mutating PII", () => {
    const result = reconcileOrderRecords([
      {
        id: "order-1",
        orderNumber: "A33-TEST-0001",
        orderStatus: "COMPLETED",
        allocationStatus: "ALLOCATED",
        paymentStatus: "PAID",
        fulfillmentStatus: "DELIVERED",
        allocations: [
          {
            id: "allocation-1",
            status: "ALLOCATED",
            reservationId: "reservation-1",
            quantity: 1,
            reservation: {
              id: "reservation-1",
              status: "FULFILLED",
              quantity: 1,
            },
            deviceAssignments: [{ id: "assignment-1", status: "FULFILLED" }],
          },
        ],
        fulfillment: { status: "DELIVERED" },
      },
    ]);
    expect(result).toEqual({ ordersChecked: 1, drift: [], isReconciled: true });
  });

  it("reports actionable reservation and completion drift", () => {
    const result = reconcileOrderRecords([
      {
        id: "order-2",
        orderNumber: "A33-TEST-0002",
        orderStatus: "COMPLETED",
        allocationStatus: "ALLOCATED",
        paymentStatus: "UNPAID",
        fulfillmentStatus: "DELIVERED",
        allocations: [
          {
            id: "allocation-2",
            status: "ALLOCATED",
            reservationId: "reservation-2",
            quantity: 1,
            reservation: { id: "reservation-2", status: "ACTIVE", quantity: 2 },
            deviceAssignments: [{ id: "assignment-2", status: "RELEASED" }],
          },
        ],
        fulfillment: { status: "DELIVERED" },
      },
    ]);
    expect(result.isReconciled).toBe(false);
    expect(result.drift.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining([
        "ALLOCATION_RESERVATION_QUANTITY_MISMATCH",
        "COMPLETED_ORDER_NOT_PAID",
        "COMPLETED_ORDER_RESERVATION_NOT_FULFILLED",
        "DELIVERED_RESERVATION_NOT_FULFILLED",
        "TRACKED_ASSIGNMENT_STATUS_MISMATCH",
      ]),
    );
  });

  it("keeps reconciliation options read-only and explicit", () => {
    expect(
      parseOrderReconciliationArguments(["--json", "--fail-on-drift"]),
    ).toEqual({ json: true, failOnDrift: true });
    expect(() => parseOrderReconciliationArguments(["--repair"])).toThrow(
      "Unsupported argument: --repair",
    );
  });

  it("emits only sanitized disposable-environment metadata for retained evidence", () => {
    const metadata = orderEvidenceMetadata(validEnvironment());
    expect(metadata.testDatabase).toEqual({
      protocol: "postgresql:",
      host: "127.0.0.1",
      port: "55434",
      database: "apple333_phase07_order_test",
      role: "apple333_phase07_order_test",
      schema: "public",
    });
    expect(JSON.stringify(metadata)).not.toContain("local-test-password");
  });
});
