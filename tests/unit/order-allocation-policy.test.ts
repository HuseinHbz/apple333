import { describe, expect, it } from "vitest";

import type { OrderInventoryCandidate } from "@/server/repositories/order-repository";
import {
  OrderInventoryError,
  planSingleBranchAllocation,
} from "@/server/services/order-inventory-service";

function candidate(
  input: Readonly<{
    id: string;
    variantId: string;
    branchId: string;
    branchCode: string;
    warehouseId: string;
    availableQuantity: number;
  }>,
): OrderInventoryCandidate {
  return {
    id: input.id,
    warehouseId: input.warehouseId,
    availableQuantity: input.availableQuantity,
    sku: { variantId: input.variantId },
    location: {
      warehouse: {
        id: input.warehouseId,
        branch: { id: input.branchId, code: input.branchCode },
      },
    },
  } as OrderInventoryCandidate;
}

describe("single-branch order allocation policy", () => {
  const lines = [
    { variantId: "variant-a", quantity: 1 },
    { variantId: "variant-b", quantity: 1 },
  ] as const;

  it("honors a selected pickup branch only when it can fulfill every line", () => {
    const plan = planSingleBranchAllocation(
      lines,
      [
        candidate({
          id: "a-1",
          variantId: "variant-a",
          branchId: "branch-a",
          branchCode: "A",
          warehouseId: "warehouse-a",
          availableQuantity: 2,
        }),
        candidate({
          id: "a-2",
          variantId: "variant-b",
          branchId: "branch-a",
          branchCode: "A",
          warehouseId: "warehouse-a",
          availableQuantity: 2,
        }),
        candidate({
          id: "b-1",
          variantId: "variant-a",
          branchId: "branch-b",
          branchCode: "B",
          warehouseId: "warehouse-b",
          availableQuantity: 9,
        }),
        candidate({
          id: "b-2",
          variantId: "variant-b",
          branchId: "branch-b",
          branchCode: "B",
          warehouseId: "warehouse-b",
          availableQuantity: 9,
        }),
      ],
      "branch-b",
    );

    expect(plan).toMatchObject({
      branchId: "branch-b",
      warehouseId: "warehouse-b",
    });
    expect(
      plan.allocations.map((allocation) => allocation.inventoryItem.id),
    ).toEqual(["b-1", "b-2"]);
  });

  it("chooses the deterministic first eligible branch and never silently splits an order", () => {
    const plan = planSingleBranchAllocation(
      lines,
      [
        candidate({
          id: "b-1",
          variantId: "variant-a",
          branchId: "branch-b",
          branchCode: "B",
          warehouseId: "warehouse-b",
          availableQuantity: 9,
        }),
        candidate({
          id: "b-2",
          variantId: "variant-b",
          branchId: "branch-b",
          branchCode: "B",
          warehouseId: "warehouse-b",
          availableQuantity: 9,
        }),
        candidate({
          id: "a-1",
          variantId: "variant-a",
          branchId: "branch-a",
          branchCode: "A",
          warehouseId: "warehouse-a",
          availableQuantity: 1,
        }),
        candidate({
          id: "a-2",
          variantId: "variant-b",
          branchId: "branch-a",
          branchCode: "A",
          warehouseId: "warehouse-a",
          availableQuantity: 1,
        }),
      ],
      undefined,
    );
    expect(plan.branchId).toBe("branch-a");

    expect(() =>
      planSingleBranchAllocation(
        lines,
        [
          candidate({
            id: "only-a",
            variantId: "variant-a",
            branchId: "branch-a",
            branchCode: "A",
            warehouseId: "warehouse-a",
            availableQuantity: 1,
          }),
          candidate({
            id: "only-b",
            variantId: "variant-b",
            branchId: "branch-b",
            branchCode: "B",
            warehouseId: "warehouse-b",
            availableQuantity: 1,
          }),
        ],
        undefined,
      ),
    ).toThrow(OrderInventoryError);
  });

  it("rejects insufficient stock even when the inventory item exists", () => {
    expect(() =>
      planSingleBranchAllocation(
        [{ variantId: "variant-a", quantity: 2 }],
        [
          candidate({
            id: "a-1",
            variantId: "variant-a",
            branchId: "branch-a",
            branchCode: "A",
            warehouseId: "warehouse-a",
            availableQuantity: 1,
          }),
        ],
        undefined,
      ),
    ).toThrow(/No active branch can fulfill/i);
  });
});
