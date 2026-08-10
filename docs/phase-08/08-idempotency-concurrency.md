# Idempotency and Concurrency

Every create, initialize, verify, callback, completion, refund create, and
refund-provider operation uses `{scope, key, requestHash}` persisted in
`PaymentIdempotencyRecord`.

- same key + same hash returns the original safe response reference;
- same key + different hash returns `PAYMENT_IDEMPOTENCY_CONFLICT`;
- unique constraints select one winner for concurrent duplicates;
- Payment `version` prevents stale state changes;
- serializable transactions retry only recognized serialization/deadlock
  failures with a small bounded count;
- verification/callback completion shares a canonical provider-reference key,
  so redirect-before-callback and callback-before-redirect converge;
- refund transactions lock the Payment row before calculating successful and
  in-flight refund totals, preventing concurrent over-refund;
- all guarantees are PostgreSQL-backed and survive process restart.
