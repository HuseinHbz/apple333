import { describe, expect, it } from "vitest";

import {
  collectMetrics,
  recordOrderCommand,
  recordOrderLifecycleEvent,
} from "@/server/monitoring/metrics";

describe("order operational metrics", () => {
  it("publishes only bounded OMS labels and lifecycle counters", async () => {
    recordOrderCommand("create", "success", 12);
    recordOrderCommand("allocate", "failure", 7, "ORDER_INVENTORY_UNAVAILABLE");
    recordOrderCommand("confirm", "replay", 4);
    recordOrderLifecycleEvent("created");
    recordOrderLifecycleEvent("confirmed");

    const metrics = await collectMetrics();
    expect(metrics).toContain("apple333_order_commands_total");
    expect(metrics).toContain('operation="create",result="success"');
    expect(metrics).toContain('operation="allocate",result="failure"');
    expect(metrics).toContain("apple333_order_allocation_failures_total");
    expect(metrics).toContain("apple333_order_idempotency_replays_total");
    expect(metrics).toContain("apple333_orders_created_total");
    expect(metrics).not.toContain("customer@example.test");
  });
});
