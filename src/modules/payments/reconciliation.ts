import type { PaymentStatus } from "./types";

export type ProviderReconciliationSnapshot = Readonly<{
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED";
  amountRials: bigint;
  currency: string;
  providerReference: string | null;
}>;

export type PaymentReconciliationInput = Readonly<{
  internalStatus: PaymentStatus;
  internalAmountRials: bigint;
  internalCurrency: string;
  capturedRefundRials: bigint;
  expectedRefundRials: bigint;
  provider: ProviderReconciliationSnapshot;
  orderExists: boolean;
  duplicateProviderReference: boolean;
  hasUnprocessedCallback: boolean;
}>;

export type PaymentDifferenceType =
  | "NONE"
  | "INTERNAL_PAID_PROVIDER_NOT_PAID"
  | "PROVIDER_PAID_INTERNAL_NOT_PAID"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "DUPLICATE_PROVIDER_REFERENCE"
  | "MISSING_ORDER"
  | "REFUND_MISMATCH"
  | "UNPROCESSED_CALLBACK";

export function findPaymentDifference(
  input: PaymentReconciliationInput,
): PaymentDifferenceType {
  if (!input.orderExists) return "MISSING_ORDER";
  if (input.duplicateProviderReference) return "DUPLICATE_PROVIDER_REFERENCE";
  if (input.internalCurrency !== input.provider.currency)
    return "CURRENCY_MISMATCH";
  if (input.internalAmountRials !== input.provider.amountRials)
    return "AMOUNT_MISMATCH";
  if (input.capturedRefundRials !== input.expectedRefundRials)
    return "REFUND_MISMATCH";
  if (input.hasUnprocessedCallback) return "UNPROCESSED_CALLBACK";
  const internalPaid = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(
    input.internalStatus,
  );
  const providerPaid = input.provider.status === "PAID";
  if (internalPaid && !providerPaid) return "INTERNAL_PAID_PROVIDER_NOT_PAID";
  if (!internalPaid && providerPaid) return "PROVIDER_PAID_INTERNAL_NOT_PAID";
  return "NONE";
}
