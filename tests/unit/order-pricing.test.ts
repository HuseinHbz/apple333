import { describe, expect, it } from "vitest";

import {
  calculateOrderLinePricing,
  calculateOrderPricing,
  OrderPricingError,
  parseOrderMoneyRials,
  toOrderPricingSummaryDto,
} from "@/modules/orders/pricing";
import { MAX_ORDER_MONEY_RIALS } from "@/modules/orders/types";

describe("order pricing", () => {
  it("calculates deterministic bigint totals from server-side components", () => {
    const summary = calculateOrderPricing({
      currency: " irr ",
      lines: [
        {
          quantity: 2,
          unitPriceRials: 100n,
          discountAmountRials: 20n,
          taxAmountRials: 5n,
        },
        { quantity: 1, unitPriceRials: 50n, taxAmountRials: 7n },
      ],
      discountTotalRials: 10n,
      taxTotalRials: 2n,
      shippingTotalRials: 20n,
      feeTotalRials: 3n,
    });

    expect(summary.currency).toBe("IRR");
    expect(summary.lines).toEqual([
      {
        quantity: 2,
        unitPriceRials: 100n,
        subtotalRials: 200n,
        discountAmountRials: 20n,
        taxAmountRials: 5n,
        lineTotalRials: 185n,
      },
      {
        quantity: 1,
        unitPriceRials: 50n,
        subtotalRials: 50n,
        discountAmountRials: 0n,
        taxAmountRials: 7n,
        lineTotalRials: 57n,
      },
    ]);
    expect(summary.subtotalRials).toBe(250n);
    expect(summary.discountTotalRials).toBe(30n);
    expect(summary.taxTotalRials).toBe(14n);
    expect(summary.grandTotalRials).toBe(257n);
    expect(toOrderPricingSummaryDto(summary)).toMatchObject({
      grandTotalRials: "257",
      subtotalRials: "250",
    });
  });

  it("never accepts a line discount greater than its subtotal", () => {
    expect(() =>
      calculateOrderLinePricing({
        quantity: 1,
        unitPriceRials: 10n,
        discountAmountRials: 11n,
      }),
    ).toThrow(OrderPricingError);
    expect(() =>
      calculateOrderPricing({
        currency: "IRR",
        lines: [{ quantity: 1, unitPriceRials: 10n }],
        discountTotalRials: 11n,
      }),
    ).toThrow(OrderPricingError);
  });

  it("rejects empty, fractional, negative, and overflowing monetary calculations", () => {
    expect(() => calculateOrderPricing({ currency: "IRR", lines: [] })).toThrow(
      /at least one line/i,
    );
    expect(() =>
      calculateOrderLinePricing({ quantity: 1.5, unitPriceRials: 10n }),
    ).toThrow(/quantity/i);
    expect(() =>
      calculateOrderLinePricing({ quantity: 1, unitPriceRials: -1n }),
    ).toThrow(/non-negative/i);
    expect(() =>
      calculateOrderLinePricing({
        quantity: 2,
        unitPriceRials: MAX_ORDER_MONEY_RIALS,
      }),
    ).toThrow(/range/i);
  });

  it("parses JSON monetary strings without floating-point conversion", () => {
    expect(parseOrderMoneyRials("9007199254740993")).toBe(
      9_007_199_254_740_993n,
    );
    expect(() => parseOrderMoneyRials("1.25")).toThrow(OrderPricingError);
    expect(() => parseOrderMoneyRials("-1")).toThrow(OrderPricingError);
    expect(() => parseOrderMoneyRials("9223372036854775808")).toThrow(
      OrderPricingError,
    );
  });
});
