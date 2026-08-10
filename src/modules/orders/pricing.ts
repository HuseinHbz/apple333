import { MAX_ORDER_MONEY_RIALS } from "./types";
import type {
  OrderCalculatedLine,
  OrderItemPricingInput,
  OrderMoney,
  OrderPricingInput,
  OrderPricingSummary,
  OrderPricingSummaryDto,
} from "./types";

export class OrderPricingError extends Error {
  public constructor(
    public readonly code:
      | "EMPTY_ORDER"
      | "INVALID_CURRENCY"
      | "INVALID_MONEY"
      | "INVALID_QUANTITY"
      | "DISCOUNT_EXCEEDS_SUBTOTAL"
      | "MONEY_OVERFLOW",
    message: string,
  ) {
    super(message);
    this.name = "OrderPricingError";
  }
}

const ZERO_MONEY = 0n;
const ISO_CURRENCY = /^[A-Z]{3}$/;

function pricingError(code: OrderPricingError["code"], message: string): never {
  throw new OrderPricingError(code, message);
}

function assertMoney(
  value: unknown,
  field: string,
): asserts value is OrderMoney {
  if (typeof value !== "bigint" || value < ZERO_MONEY) {
    pricingError("INVALID_MONEY", `${field} must be a non-negative bigint.`);
  }
  if (value > MAX_ORDER_MONEY_RIALS) {
    pricingError(
      "MONEY_OVERFLOW",
      `${field} exceeds the supported signed 64-bit money range.`,
    );
  }
}

function assertPositiveQuantity(value: unknown): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 1_000_000
  ) {
    pricingError(
      "INVALID_QUANTITY",
      "Order line quantity must be a positive safe integer no greater than 1,000,000.",
    );
  }
}

function addMoney(
  left: OrderMoney,
  right: OrderMoney,
  field: string,
): OrderMoney {
  const total = left + right;
  if (total > MAX_ORDER_MONEY_RIALS) {
    pricingError(
      "MONEY_OVERFLOW",
      `${field} exceeds the supported signed 64-bit money range.`,
    );
  }
  return total;
}

function optionalMoney(
  value: OrderMoney | undefined,
  field: string,
): OrderMoney {
  if (value === undefined) return ZERO_MONEY;
  assertMoney(value, field);
  return value;
}

/**
 * Parse a decimal minor-unit string without ever passing through JavaScript's
 * floating-point number representation. It is intentionally useful only at a
 * server boundary; clients never provide authoritative order totals.
 */
export function parseOrderMoneyRials(value: string): OrderMoney {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)$/.test(normalized)) {
    pricingError(
      "INVALID_MONEY",
      "Money must be an unsigned decimal integer in minor units.",
    );
  }

  const money = BigInt(normalized);
  assertMoney(money, "money");
  return money;
}

export function calculateOrderLinePricing(
  input: OrderItemPricingInput,
): OrderCalculatedLine {
  assertPositiveQuantity(input.quantity);
  assertMoney(input.unitPriceRials, "unitPriceRials");

  const discountAmountRials = optionalMoney(
    input.discountAmountRials,
    "discountAmountRials",
  );
  const taxAmountRials = optionalMoney(input.taxAmountRials, "taxAmountRials");
  const subtotalRials = input.unitPriceRials * BigInt(input.quantity);
  if (subtotalRials > MAX_ORDER_MONEY_RIALS) {
    pricingError(
      "MONEY_OVERFLOW",
      "Line subtotal exceeds the supported signed 64-bit money range.",
    );
  }
  if (discountAmountRials > subtotalRials) {
    pricingError(
      "DISCOUNT_EXCEEDS_SUBTOTAL",
      "A line discount cannot exceed its line subtotal.",
    );
  }

  const lineTotalRials = addMoney(
    subtotalRials - discountAmountRials,
    taxAmountRials,
    "lineTotalRials",
  );

  return {
    quantity: input.quantity,
    unitPriceRials: input.unitPriceRials,
    subtotalRials,
    discountAmountRials,
    taxAmountRials,
    lineTotalRials,
  };
}

/**
 * Recalculate all persisted order totals from authoritative server-side line
 * snapshots. No supplied grand total is accepted by this API.
 */
export function calculateOrderPricing(
  input: OrderPricingInput,
): OrderPricingSummary {
  const currency = input.currency.trim().toUpperCase();
  if (!ISO_CURRENCY.test(currency)) {
    pricingError(
      "INVALID_CURRENCY",
      "Currency must be a three-letter ISO code.",
    );
  }
  if (input.lines.length === 0) {
    pricingError("EMPTY_ORDER", "An order must contain at least one line.");
  }

  const orderDiscountTotalRials = optionalMoney(
    input.discountTotalRials,
    "discountTotalRials",
  );
  const orderTaxTotalRials = optionalMoney(
    input.taxTotalRials,
    "taxTotalRials",
  );
  const shippingTotalRials = optionalMoney(
    input.shippingTotalRials,
    "shippingTotalRials",
  );
  const feeTotalRials = optionalMoney(input.feeTotalRials, "feeTotalRials");

  let subtotalRials = ZERO_MONEY;
  let lineDiscountTotalRials = ZERO_MONEY;
  let lineTaxTotalRials = ZERO_MONEY;
  const lines: OrderCalculatedLine[] = [];

  for (const line of input.lines) {
    const calculatedLine = calculateOrderLinePricing(line);
    lines.push(calculatedLine);
    subtotalRials = addMoney(
      subtotalRials,
      calculatedLine.subtotalRials,
      "subtotalRials",
    );
    lineDiscountTotalRials = addMoney(
      lineDiscountTotalRials,
      calculatedLine.discountAmountRials,
      "discountTotalRials",
    );
    lineTaxTotalRials = addMoney(
      lineTaxTotalRials,
      calculatedLine.taxAmountRials,
      "taxTotalRials",
    );
  }

  const discountTotalRials = addMoney(
    lineDiscountTotalRials,
    orderDiscountTotalRials,
    "discountTotalRials",
  );
  if (discountTotalRials > subtotalRials) {
    pricingError(
      "DISCOUNT_EXCEEDS_SUBTOTAL",
      "Total discount cannot exceed the order subtotal.",
    );
  }
  const taxTotalRials = addMoney(
    lineTaxTotalRials,
    orderTaxTotalRials,
    "taxTotalRials",
  );
  const grandTotalRials = addMoney(
    addMoney(
      addMoney(
        subtotalRials - discountTotalRials,
        taxTotalRials,
        "grandTotalRials",
      ),
      shippingTotalRials,
      "grandTotalRials",
    ),
    feeTotalRials,
    "grandTotalRials",
  );

  return {
    currency,
    lines,
    subtotalRials,
    discountTotalRials,
    taxTotalRials,
    shippingTotalRials,
    feeTotalRials,
    grandTotalRials,
  };
}

/** Backwards-friendly name for service code that talks about totals rather than pricing. */
export const calculateOrderTotals = calculateOrderPricing;

export function toOrderPricingSummaryDto(
  summary: OrderPricingSummary,
): OrderPricingSummaryDto {
  return {
    currency: summary.currency,
    subtotalRials: summary.subtotalRials.toString(),
    discountTotalRials: summary.discountTotalRials.toString(),
    taxTotalRials: summary.taxTotalRials.toString(),
    shippingTotalRials: summary.shippingTotalRials.toString(),
    feeTotalRials: summary.feeTotalRials.toString(),
    grandTotalRials: summary.grandTotalRials.toString(),
  };
}
