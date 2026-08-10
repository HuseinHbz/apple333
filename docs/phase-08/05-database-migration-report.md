# Database Migration Report

## Pre-change status

This report was created before modifying `prisma/schema.prisma`. The baseline
contains `Order`, `OrderPayment`, `OrderIdempotencyRecord`, `OrderOutboxEvent`,
and `AuditLog`. `OrderPayment` contains Phase 07 placeholders/manual metadata
and cannot safely be renamed into the canonical Payment aggregate.

## Additive migration plan

Create only new enums, tables, constraints, indexes, foreign keys, and
append-only protection for:

- `Payment`;
- `PaymentAttempt`;
- `PaymentTransaction`;
- `PaymentCallback`;
- `Refund`;
- `PaymentReconciliationRecord`;
- `PaymentIdempotencyRecord`;
- `PaymentOutboxEvent`.

Add an optional `payments` relation to `Order` and audit/outbox relations as
required by Prisma. `Payment.orderId` is unique so API creation returns the one
canonical aggregate for an Order. Financial foreign keys use `RESTRICT`; no
payment evidence is cascade-deleted.

## Legacy compatibility

- Do not drop, rename, truncate, or rewrite `OrderPayment`.
- Do not convert `PHASE_08_PENDING` placeholders into verified payments.
- New canonical Payments are created lazily from persisted Orders.
- Stop creating new legacy placeholders after activation.
- Keep `Order.paymentStatus` as an order summary projection; update it only in
  the verified Payment transaction.
- Disable the legacy manual PAID route rather than deleting historical data.

## Planned database invariants

- unique payment number and unique Order-to-Payment mapping;
- non-negative Payment/attempt/transaction amounts and positive refunds;
- version and attempt numbers greater than zero;
- unique scoped idempotency keys with request hashes;
- unique provider authority/reference in its provider scope where present;
- unique provider/external callback event identity;
- indexes for order, number, status/time, provider/reference, attempts,
  callbacks, refunds, reconciliation, idempotency expiry, and outbox dispatch;
- append-only `PaymentTransaction` enforcement;
- refund sum bound enforced by a locked serializable service transaction.

## SQL review gates

Generated SQL must contain no `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, destructive
`ALTER`, or legacy-row update. It must be validated and applied first to the
owned disposable Phase 08 PostgreSQL target. `prisma db push`, migration reset,
and production migration are prohibited.

## Rollback strategy

Before production adoption, rollback means disabling Phase 08 routes/workers
and leaving additive evidence tables intact. Destructive rollback SQL will not
be generated. A later archival/removal decision requires a separately approved
data-retention migration.
