# Phase 07 Order State Machine

## Ownership

Only `OrderService` may change an order lifecycle field. Route handlers, React
components, and repositories receive commands but never set `orderStatus`
directly.

Every accepted transition requires the current optimistic `version`, appends an
`OrderStatusHistory` entry, writes a redacted `AuditLog`, and adds a
transactional outbox event. A stale version returns `ORDER_VERSION_CONFLICT`.

## Order lifecycle

```text
DRAFT
  └─> PENDING_CONFIRMATION
          ├─> CONFIRMED ─> PROCESSING ─> COMPLETED
          ├─> CANCELLED
          └─> REJECTED
```

### Permitted transitions

| From | To | Required conditions | Effects |
| --- | --- | --- | --- |
| `DRAFT` | `PENDING_CONFIRMATION` | Valid immutable snapshot, at least one line, server-calculated totals, active reservations and allocations | `order.created`, history, audit, outbox |
| `PENDING_CONFIRMATION` | `CONFIRMED` | All allocations active, each reservation active, payment policy permits review confirmation | `order.confirmed`, history, audit, outbox |
| `CONFIRMED` | `PROCESSING` | Allocations remain active and order is not cancelled | history, audit, outbox |
| `PROCESSING` | `COMPLETED` | Fulfillment is delivered/ready-for-pickup and payment is `PAID` | consume reservations, mark tracked units sold, history, audit, outbox |
| `PENDING_CONFIRMATION` | `CANCELLED` | A cancellation reason is supplied | release active reservations, cancel pending payment attempts, history, audit, outbox |
| `CONFIRMED` | `CANCELLED` | Authorized actor, reason, no terminal fulfillment | release reservations/allocation, flag refund review when applicable, history, audit, outbox |

All other transitions fail closed with `ORDER_INVALID_TRANSITION`.

## Supporting state dimensions

- `paymentStatus` represents payment evidence only. Phase 07 records manual
  or future-provider attempts but does not call a payment gateway.
- `allocationStatus` is `UNALLOCATED`, `PARTIALLY_ALLOCATED`, `ALLOCATED`,
  `ALLOCATION_FAILED`, or `RELEASED`.
- `fulfillmentStatus` is independent of order lifecycle so a fulfillment can
  be prepared before the final financial completion gate is met.

## Cancellation policy

Customer cancellation is allowed only while the order is
`PENDING_CONFIRMATION`. Authorized staff may cancel a `CONFIRMED` order only
before a terminal shipment/pickup state. Any paid amount remains an explicit
`refund_required` event for Phase 08; Phase 07 never attempts settlement.

## Idempotency and concurrency

Each mutation has an actor/guest-and-operation scoped `Idempotency-Key` and a
stable request hash. Replaying the same key and hash returns the original
resource. Reusing a key with different input returns
`ORDER_IDEMPOTENCY_CONFLICT`. Serializable transactions and conditional version
updates prevent duplicate orders, lost updates, and final-stock overselling.
