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
- initialization, verification, failed/received callbacks, and pending refunds
  resume safely from durable intent after process interruption;
- redirect-before-callback and callback-before-redirect converge through the
  same Payment aggregate, authority match, row/version guards, and append-only
  evidence;
- refund transactions lock the Payment row before calculating successful and
  in-flight refund totals, preventing concurrent over-refund;
- reconciliation persists its idempotency key atomically with the exact
  evidence record, so failed work cannot leave a false replay;
- Prisma `P2034` and raw-query SQLSTATE `40001` serialization conflicts receive
  the same bounded retry treatment; and
- all guarantees are PostgreSQL-backed and survive process restart.
