# Phase 07 Order State Machine

## Ownership and durability

Only `OrderService` changes lifecycle fields. Route handlers, React components,
and repositories issue typed commands or queries; they never set
`orderStatus` directly.

Every accepted lifecycle command checks the caller’s scope and current
optimistic `version`, writes `OrderStatusHistory`, writes a redacted audit row,
and creates a transactional outbox event. An invalid lifecycle transition is
rejected with `ORDER_INVALID_TRANSITION` and also writes a redacted,
out-of-transaction rejection audit record; it does not mutate the order.

## Implemented lifecycle

```text
DRAFT
  -> PENDING_CONFIRMATION
       -> CONFIRMED
            -> PROCESSING
                 -> COMPLETED
       -> CANCELLED
       -> REJECTED
```

`DRAFT` is an internal short-lived construction state. Creation validates and
persists the order to `PENDING_CONFIRMATION` in the same transaction; it is not
an exposed customer workflow state.

| Command             | Required starting state / conditions                                                                                                                             | Effects                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Create              | Valid cart/admin request, server snapshots and price calculation, active reservation/allocation                                                                  | Creates `PENDING_CONFIRMATION` order, history, audit, outbox; active reservation lasts 15 minutes.                                          |
| Confirm             | `PENDING_CONFIRMATION`, active complete allocation/reservation, matching version                                                                                 | Changes to `CONFIRMED`; active reservations are extended to 72 hours.                                                                       |
| Allocate            | Eligible unconfirmed/confirmed allocation context, matching version, actor has branch scope                                                                      | Re-plans a complete single-branch allocation and preserves history/audit/outbox.                                                            |
| Fulfillment update  | Permitted fulfillment progression, matching version, actor has fulfillment scope                                                                                 | Creates/updates fulfillment evidence; delivered fulfillment consumes stock and reaches terminal order state when policy conditions are met. |
| Payment record      | Matching version, finance permission                                                                                                                             | Records a payment attempt/status only; it does not call a payment gateway.                                                                  |
| Cancel              | Customer own pending order, or authorized staff while `PENDING_CONFIRMATION`, `CONFIRMED`, or `PROCESSING` is not shipped/delivered; reason and matching version | Releases eligible reservations/device assignments, changes status, and emits history/audit/outbox.                                          |
| Expire reservations | Active order reservation past expiry, guarded invocation                                                                                                         | Releases inventory/device assignments and records the expiry path. A production scheduler is out of scope.                                  |

The precise permitted graph and transition errors are implemented in
`src/modules/orders/state-machine.ts`; service-level conditions additionally
verify inventory, payment, fulfillment, branch scope, and expected version.

## Supporting state dimensions

- `paymentStatus` records payment evidence. Phase 07 records manual/future-
  provider attempts but does not settle payments or store card data.
- `allocationStatus` records whether the complete single-branch allocation is
  active, failed, or released.
- `fulfillmentStatus` is independent from the order lifecycle and tracks
  `PENDING` through `DELIVERED` as an operational process.
- Inventory reservations use the pre-existing Phase 06 `FULFILLED` value when
  consumed; OMS does not create a conflicting storage enum.

## Cancellation and fulfillment policy

Customer cancellation is restricted to the customer’s own
`PENDING_CONFIRMATION` order and requires `orders.read_own` in the service as
well as route-level authentication. Staff cancellation is permission and
branch-scope checked. If a payment has been recorded, the system emits durable
order evidence for later refund orchestration; Phase 07 never settles a refund.

On cancellation or expiry, active allocations/reservations release once and
tracked assignments become `RELEASED`. `DELIVERED` fulfillment consumes
inventory: reservations become `FULFILLED`, stock movements use
`SALE_FULFILLED`, device units become sold, and tracked assignments become
`FULFILLED` historical evidence. Completion requires the relevant delivered or
pickup-collected condition plus `PAID`; recording payment can complete an
already delivered/processing order when that condition is met.

## Idempotency and concurrency

Each mutation uses an actor-and-operation-scoped idempotency key plus a stable
request hash. Identical retries replay the durable outcome; changed input with
the same key fails with `ORDER_IDEMPOTENCY_CONFLICT`. Serializable transactions
and conditional version updates prevent duplicate orders, lost updates,
final-stock overselling, and duplicate tracked-device allocation. Real
PostgreSQL verification of those properties remains pending in CI/runtime
evidence.
