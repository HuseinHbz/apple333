import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { validateOrderTestEnvironment } from "./verify-order-test-environment.mjs";

function normalizeOrderRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    orderNumber: row.orderNumber,
    orderStatus: row.orderStatus,
    allocationStatus: row.allocationStatus,
    paymentStatus: row.paymentStatus,
    fulfillmentStatus: row.fulfillmentStatus,
    allocations: row.allocations ?? [],
    fulfillment: row.fulfillment ?? null,
  }));
}

function drift(order, kind, detail) {
  return { kind, orderId: order.id, orderNumber: order.orderNumber, detail };
}

/**
 * Pure reconciliation policy shared by the guarded command and unit tests.
 * It never mutates data. "FULFILLED" is the existing Phase 06 reservation
 * terminal value, equivalent to consumed inventory for OMS purposes.
 */
export function reconcileOrderRecords(records) {
  const driftEntries = [];
  for (const order of normalizeOrderRows(records)) {
    const activeAllocations = order.allocations.filter(
      (allocation) => allocation.status === "ALLOCATED",
    );
    const activeReservations = activeAllocations.filter(
      (allocation) => allocation.reservation?.status === "ACTIVE",
    );
    const fulfilledReservations = activeAllocations.filter(
      (allocation) => allocation.reservation?.status === "FULFILLED",
    );

    for (const allocation of activeAllocations) {
      if (!allocation.reservationId || !allocation.reservation) {
        driftEntries.push(
          drift(
            order,
            "ACTIVE_ALLOCATION_WITHOUT_RESERVATION",
            `Allocation ${allocation.id} is active without a linked reservation.`,
          ),
        );
        continue;
      }
      if (allocation.reservation.quantity !== allocation.quantity) {
        driftEntries.push(
          drift(
            order,
            "ALLOCATION_RESERVATION_QUANTITY_MISMATCH",
            `Allocation ${allocation.id} quantity=${allocation.quantity}, reservation=${allocation.reservation.quantity}.`,
          ),
        );
      }
      if (!["ACTIVE", "FULFILLED"].includes(allocation.reservation.status)) {
        driftEntries.push(
          drift(
            order,
            "ACTIVE_ALLOCATION_WITH_TERMINAL_RESERVATION",
            `Allocation ${allocation.id} has reservation status ${allocation.reservation.status}.`,
          ),
        );
      }
      const trackedAssignments = allocation.deviceAssignments ?? [];
      if (
        trackedAssignments.length > 0 &&
        trackedAssignments.length !== allocation.quantity
      ) {
        driftEntries.push(
          drift(
            order,
            "TRACKED_ASSIGNMENT_QUANTITY_MISMATCH",
            `Allocation ${allocation.id} quantity=${allocation.quantity}, device assignments=${trackedAssignments.length}.`,
          ),
        );
      }
      const expectedTrackedStatus =
        allocation.reservation.status === "FULFILLED"
          ? "FULFILLED"
          : "RESERVED";
      if (
        trackedAssignments.some(
          (assignment) => assignment.status !== expectedTrackedStatus,
        )
      ) {
        driftEntries.push(
          drift(
            order,
            "TRACKED_ASSIGNMENT_STATUS_MISMATCH",
            `Allocation ${allocation.id} has an assignment inconsistent with reservation status ${allocation.reservation.status}.`,
          ),
        );
      }
    }

    for (const allocation of order.allocations) {
      if (
        allocation.status === "RELEASED" &&
        (allocation.deviceAssignments ?? []).some(
          (assignment) => assignment.status === "RESERVED",
        )
      ) {
        driftEntries.push(
          drift(
            order,
            "RELEASED_ALLOCATION_HAS_ACTIVE_TRACKED_ASSIGNMENT",
            `Allocation ${allocation.id} is released but retains a reserved device assignment.`,
          ),
        );
      }
    }

    if (
      order.allocationStatus === "ALLOCATED" &&
      activeAllocations.length === 0
    ) {
      driftEntries.push(
        drift(
          order,
          "ALLOCATED_STATUS_WITHOUT_ACTIVE_ALLOCATIONS",
          "Order is marked ALLOCATED but has no active allocations.",
        ),
      );
    }
    if (order.allocationStatus === "RELEASED" && activeAllocations.length > 0) {
      driftEntries.push(
        drift(
          order,
          "RELEASED_STATUS_WITH_ACTIVE_ALLOCATIONS",
          "Order is marked RELEASED but still has active allocations.",
        ),
      );
    }

    if (
      ["PENDING_CONFIRMATION", "CONFIRMED"].includes(order.orderStatus) &&
      activeAllocations.length > 0 &&
      activeReservations.length !== activeAllocations.length
    ) {
      driftEntries.push(
        drift(
          order,
          "PRE_DELIVERY_RESERVATION_NOT_ACTIVE",
          "Pre-delivery order has an allocation whose reservation is not active.",
        ),
      );
    }
    if (order.orderStatus === "COMPLETED") {
      if (order.paymentStatus !== "PAID") {
        driftEntries.push(
          drift(
            order,
            "COMPLETED_ORDER_NOT_PAID",
            `Completed order payment status is ${order.paymentStatus}.`,
          ),
        );
      }
      if (!order.fulfillment || order.fulfillment.status !== "DELIVERED") {
        driftEntries.push(
          drift(
            order,
            "COMPLETED_ORDER_NOT_DELIVERED",
            "Completed order has no delivered fulfillment.",
          ),
        );
      }
      if (activeAllocations.length !== fulfilledReservations.length) {
        driftEntries.push(
          drift(
            order,
            "COMPLETED_ORDER_RESERVATION_NOT_FULFILLED",
            "Completed order retains a non-fulfilled active allocation reservation.",
          ),
        );
      }
    }
    if (order.fulfillment) {
      if (order.fulfillment.status !== order.fulfillmentStatus) {
        driftEntries.push(
          drift(
            order,
            "FULFILLMENT_STATUS_MISMATCH",
            `Order=${order.fulfillmentStatus}, fulfillment=${order.fulfillment.status}.`,
          ),
        );
      }
      if (
        order.fulfillment.status === "DELIVERED" &&
        activeAllocations.length !== fulfilledReservations.length
      ) {
        driftEntries.push(
          drift(
            order,
            "DELIVERED_RESERVATION_NOT_FULFILLED",
            "Delivered fulfillment retains an active or invalid reservation.",
          ),
        );
      }
    } else if (
      order.fulfillmentStatus !== "UNFULFILLED" &&
      order.fulfillmentStatus !== "CANCELLED"
    ) {
      driftEntries.push(
        drift(
          order,
          "FULFILLMENT_STATUS_WITHOUT_RECORD",
          `Order fulfillment status is ${order.fulfillmentStatus} without a fulfillment record.`,
        ),
      );
    }
  }

  return {
    ordersChecked: records.length,
    drift: driftEntries,
    isReconciled: driftEntries.length === 0,
  };
}

export function parseOrderReconciliationArguments(
  argumentsList = process.argv.slice(2),
) {
  const values = new Set(argumentsList);
  for (const value of values) {
    if (!["--json", "--fail-on-drift"].includes(value))
      throw new Error(`Unsupported argument: ${value}`);
  }
  return {
    json: values.has("--json"),
    failOnDrift: values.has("--fail-on-drift"),
  };
}

async function loadOrderRecords(prisma) {
  return prisma.order.findMany({
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      orderNumber: true,
      orderStatus: true,
      allocationStatus: true,
      paymentStatus: true,
      fulfillmentStatus: true,
      allocations: {
        select: {
          id: true,
          status: true,
          reservationId: true,
          quantity: true,
          reservation: { select: { id: true, status: true, quantity: true } },
          deviceAssignments: { select: { id: true, status: true } },
        },
      },
      fulfillment: { select: { status: true } },
    },
  });
}

async function main() {
  const preflight = validateOrderTestEnvironment(process.env);
  if (!preflight.ok)
    throw new Error(
      `Order reconciliation preflight failed: ${preflight.errors.join(" ")}`,
    );

  const options = parseOrderReconciliationArguments();
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.ORDER_TEST_DATABASE_URL } },
  });
  try {
    const result = reconcileOrderRecords(await loadOrderRecords(prisma));
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(
        `Order reconciliation: checked=${result.ordersChecked}, drift=${result.drift.length}.`,
      );
      for (const entry of result.drift)
        console.log(`${entry.kind} ${entry.orderNumber}: ${entry.detail}`);
    }
    if (options.failOnDrift && !result.isReconciled) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Order reconciliation failed.",
    );
    process.exitCode = 1;
  });
}
