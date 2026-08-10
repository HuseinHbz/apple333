# Phase 07 Architecture

## Runtime path

```text
Customer/Admin UI
  -> App Router route handler
  -> Zod validation + same-origin/rate-limit boundary
  -> session/RBAC + branch/ownership check
  -> OrderService command/query
  -> Serializable Prisma transaction
  -> Order repository + inventory reservation primitives
  -> PostgreSQL Order aggregate, audit, status history, outbox
```

The implementation lives in `src/modules/orders`,
`src/server/services/order-service.ts`,
`src/server/services/order-inventory-service.ts`, and
`src/server/repositories/order-repository.ts`. Storefront endpoints are under
`src/app/api/store/orders`; administrative endpoints are under
`src/app/api/admin/orders`.

## Aggregate and consistency model

- `Order` owns immutable customer/address/product/SKU/warranty/attribute and
  money snapshots. Money is stored as integer `BigInt` IRR values.
- `OrderItem`, `OrderAllocation`, `OrderPayment`, `OrderFulfillment`,
  `OrderStatusHistory`, `OrderNote`, idempotency rows, and outbox events are
  created or changed inside the OMS serializable transaction.
- Allocation policy is **single branch, complete order**. Split allocation is
  intentionally not enabled.
- A tracked device produces an `OrderDeviceAssignment` linked to its order
  item, allocation, reservation, and `DeviceUnit`. The assignment stays as
  `RELEASED` or `FULFILLED` evidence after the physical unit changes state.
- Commands use a scoped idempotency key and request hash plus optimistic
  `Order.version` updates. Equivalent retries replay the stored result;
  incompatible key reuse fails.

## Privacy and authority boundaries

- UI and routes never calculate a trusted price or mutate an order status.
- Customer detail/history is scoped to `customerId` and receives its own
  pricing and address snapshot only.
- Administrative PII, finance, and full IMEI/serial data each require a
  separate permission. Finance values are `null` in DTOs without
  `orders.view_financials`; IMEI/serial arrays are empty without
  `orders.view_imei`.
- Admin PII list/detail projections require correlated audit context and write
  a dedicated PII-view audit row before the projection is returned.
- Rejected lifecycle changes write a redacted rejection audit record. Accepted
  commands write history, audit, and outbox records in their transaction.

## Inventory lifecycle

1. Creation reserves canonical `InventoryItem` stock and, for a tracked SKU,
   deterministic available `DeviceUnit` rows.
2. Confirmation extends active reservations from 15 minutes to 72 hours.
3. Cancellation or expiry releases stock/device units and marks assignments
   `RELEASED`.
4. Delivered fulfillment consumes stock, marks device units `SOLD`, and marks
   assignments `FULFILLED`.

The Phase 06 inventory enum uses `FULFILLED` for a consumed reservation; OMS
does not invent a conflicting storage enum.

## Readiness and operations

`/api/ready` requires configuration, Redis, database connectivity, and the
essential OMS tables. The disposable test environment is loopback-only and
guarded before scripts import Prisma or connect. Reconciliation is read-only.

## Explicitly out of scope

Payment-gateway settlement, refunds, courier integration, accounting posting,
installment workflow, outbox publishing, and a production expiry scheduler are
not delivered by Phase 07. The outbox is durable evidence for a later publisher;
the callable expiry service needs a separately approved production worker.
