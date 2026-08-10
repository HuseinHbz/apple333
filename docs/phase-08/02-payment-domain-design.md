# Payment Domain Design

`Payment` is the aggregate root and `Order` remains the commercial authority.
One canonical Payment is created per Order; provider retries become
`PaymentAttempt` records rather than additional aggregates.

## Aggregate contents

- `Payment`: order reference, immutable IRR amount/currency, method, provider,
  status, optimistic version, and lifecycle timestamps.
- `PaymentAttempt`: each initialization authority, idempotency key, expiry, and
  provider reference.
- `PaymentTransaction`: append-only initialization, authorization, capture,
  verification, reversal, refund, and reconciliation evidence.
- `PaymentCallback`: payload hash, signature decision, external event replay
  key, and safe processing result; raw sensitive payload is not retained.
- `Refund`: bounded idempotent orchestration record without accounting entries.
- `PaymentReconciliationRecord`: point-in-time internal/provider comparison.
- supporting `PaymentIdempotencyRecord` and `PaymentOutboxEvent` records.

## Ownership boundaries

- Order owns amount due, commercial snapshot, order lifecycle, and its payment
  summary projection.
- Payment owns provider lifecycle, attempts, verification, callback evidence,
  refunds, and reconciliation.
- Inventory and fulfillment behavior remain Phase 06/07 responsibilities.
- No ledger, accounting posting, installment contract, card data, or gateway
  secret belongs to this aggregate.

All money uses integer rials (`BigInt` in Prisma/TypeScript) and serialized DTO
strings. JavaScript floating point is prohibited.
