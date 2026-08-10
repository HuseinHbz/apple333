# Provider Adapter Contract

Application services depend only on `PaymentProvider`:

```ts
interface PaymentProvider {
  initializePayment(
    input: ProviderInitializeInput,
  ): Promise<ProviderInitializeResult>;
  verifyPayment(input: ProviderVerifyInput): Promise<ProviderVerifyResult>;
  queryPayment(input: ProviderQueryInput): Promise<ProviderQueryResult>;
  cancelPaymentWhenSupported(
    input: ProviderCancelInput,
  ): Promise<ProviderCancelResult>;
  refundPaymentWhenSupported(
    input: ProviderRefundInput,
  ): Promise<ProviderRefundResult>;
  validateCallback(
    input: ProviderCallbackInput,
  ): Promise<ProviderCallbackValidation>;
}
```

Provider DTOs use canonical status/error types and bigint-safe decimal strings.
SDK payloads, HTTP status quirks, secrets, signatures, and retry mapping stay
inside adapters. Every call has a bounded timeout; retries are bounded and only
used for idempotent provider operations.

The initial adapter is `PAYMENT_SIMULATOR`, a deterministic disposable adapter
used only by the guarded Phase 08 environment. It supports success,
cancellation, decline, expiry, timeout, duplicate callback, callback/redirect
reordering, invalid signature, wrong amount, unknown authority, network retry,
and refund success/failure. The Compose simulator service is a loopback-only
health boundary; lifecycle behavior is exercised through the real application
adapter, Route Handlers, PostgreSQL transactions, and browser journeys rather
than unit-test mocks. Production gateway hosts and credentials are rejected by
test preflight.

`PAYMENT_PROVIDER_TIMEOUT_MS` is optional, defaults to 10 seconds, and is
clamped to 30 seconds. Provider calls receive at most two attempts, and only
read-only or provider-idempotent operations are eligible for retry.
