import type { PaymentSimulatorScenario } from "./types";

export type ProviderPaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export type ProviderPaymentRequest = Readonly<{
  paymentId: string;
  paymentNumber: string;
  amountRials: bigint;
  currency: string;
  returnUrl: string;
  idempotencyKey: string;
  scenario: PaymentSimulatorScenario;
  signal?: AbortSignal;
}>;

export type ProviderPaymentResult = Readonly<{
  status: ProviderPaymentStatus;
  authority: string;
  reference: string | null;
  amountRials: bigint;
  currency: string;
  providerCode: string;
  redirectUrl: string | null;
  expiresAt: Date | null;
}>;

export type ProviderVerificationRequest = Readonly<{
  authority: string;
  expectedAmountRials: bigint;
  expectedCurrency: string;
  signal?: AbortSignal;
}>;

export type ProviderRefundRequest = Readonly<{
  authority: string;
  paymentReference: string;
  amountRials: bigint;
  idempotencyKey: string;
  scenario: "refund_success" | "refund_failure";
  signal?: AbortSignal;
}>;

export type ProviderRefundResult = Readonly<{
  succeeded: boolean;
  reference: string | null;
  providerCode: string;
}>;

export type ProviderCallbackEvidence = Readonly<{
  rawPayload: string;
  externalEventId: string;
  authority: string;
  signature: string;
}>;

export class PaymentProviderError extends Error {
  public constructor(
    public readonly code:
      | "PROVIDER_TIMEOUT"
      | "PROVIDER_DECLINED"
      | "PROVIDER_INVALID_RESPONSE"
      | "PROVIDER_UNKNOWN_AUTHORITY"
      | "PROVIDER_UNAVAILABLE"
      | "PROVIDER_UNSUPPORTED_OPERATION",
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}

export interface PaymentProvider {
  readonly code: string;
  initializePayment(
    input: ProviderPaymentRequest,
  ): Promise<ProviderPaymentResult>;
  verifyPayment(
    input: ProviderVerificationRequest,
  ): Promise<ProviderPaymentResult>;
  queryPayment(
    input: ProviderVerificationRequest,
  ): Promise<ProviderPaymentResult>;
  cancelPaymentWhenSupported(authority: string): Promise<boolean>;
  refundPaymentWhenSupported(
    input: ProviderRefundRequest,
  ): Promise<ProviderRefundResult>;
  validateCallback(evidence: ProviderCallbackEvidence): Promise<boolean>;
}
