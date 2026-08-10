# Provider Adapter Contract

Application services depend only on `PaymentProvider`:

```ts
interface PaymentProvider {
  initializePayment(input: ProviderInitializeInput): Promise<ProviderInitializeResult>;
  verifyPayment(input: ProviderVerifyInput): Promise<ProviderVerifyResult>;
  queryPayment(input: ProviderQueryInput): Promise<ProviderQueryResult>;
  cancelPaymentWhenSupported(input: ProviderCancelInput): Promise<ProviderCancelResult>;
  refundPaymentWhenSupported(input: ProviderRefundInput): Promise<ProviderRefundResult>;
  validateCallback(input: ProviderCallbackInput): Promise<ProviderCallbackValidation>;
}
```

Provider DTOs use canonical status/error types and bigint-safe decimal strings.
SDK payloads, HTTP status quirks, secrets, signatures, and retry mapping stay
inside adapters. Every call has a bounded timeout; retries are bounded and only
used for idempotent provider operations.

The initial adapter is `PAYMENT_SIMULATOR`, an external disposable HTTP process
supporting success, cancellation, decline, expiry, timeout, duplicate callback,
callback/redirect reordering, invalid signature, wrong amount, unknown
authority, network retry, and refund success/failure. Production gateway hosts
and credentials are rejected by test preflight.
