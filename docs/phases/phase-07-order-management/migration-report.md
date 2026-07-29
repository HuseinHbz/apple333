# Phase 07 Migration Report

**Prepared before any Phase 07 schema modification.**

## Safety declaration

- Production or shared database access: prohibited.
- Migration style: additive only.
- Existing migrations: immutable.
- Destructive statements (`DROP`, `TRUNCATE`, reset, or data rewrite): not
  permitted.
- Validation target: an owned, disposable PostgreSQL database guarded by
  `NODE_ENV=test`, `APPLE333_TEST_DB=1`, and `APPLE333_ORDER_TEST_DB=1`.

## Existing schema dependencies

Phase 07 will reference, but not alter the semantics of:

- `User`, `Address`, `CatalogProduct`, `CatalogVariant`, and `ProductSku` for
  immutable snapshots and historical references.
- `Branch`, `Warehouse`, `InventoryItem`, `InventoryReservation`, and
  `DeviceUnit` for allocation, reservation, and IMEI/serial evidence.
- `StorefrontCart` and `StorefrontCartItem` for checkout conversion.
- `AuditLog` for correlated, redacted audit evidence.

## Planned additive database objects

The reviewed migration will introduce the following enums and tables:

- `OrderSource`, `OrderType`, `OrderStatus`, `OrderPaymentStatus`,
  `OrderAllocationStatus`, `OrderFulfillmentStatus`, `OrderFulfillmentMethod`,
  `OrderNoteVisibility`, and `OrderEventStatus`.
- `Order` with immutable customer/address snapshots, server-calculated integer
  totals, status dimensions, a positive optimistic `version`, and a unique
  external order number.
- `OrderItem` with immutable product/variant/SKU/warranty/attributes snapshots
  and positive quantity/monetary checks.
- `OrderAllocation` linked to one `OrderItem`, branch/warehouse, and an
  `InventoryReservation`.
- `OrderPayment`, `OrderFulfillment`, `OrderStatusHistory`, and `OrderNote`.
- `OrderIdempotencyRecord` with unique `(scope, key)` and a request hash.
- `OrderOutboxEvent` for transactional domain events.

## Integrity constraints and indexes

The migration must provide at least:

- a unique `Order.orderNumber`;
- a unique idempotency `(scope, key)` pair;
- unique non-null payment provider references;
- check constraints for positive item/allocation quantities and non-negative
  order money components;
- database foreign keys with `RESTRICT` or safe `SET NULL` deletion behavior;
- indexes for customer history, each lifecycle status plus creation time,
  source plus creation time, allocations, fulfillment, and timeline reads;
- an active allocation/reservation uniqueness constraint where PostgreSQL can
  express it safely via a partial index.

## Compatibility choices

`CatalogVariant.priceRials` and `ProductSku.priceRials` already use `BigInt`.
Phase 07 will preserve this integer IRR convention for all order values. It
will not introduce floating-point arithmetic or convert prior catalog data.

The order-to-inventory relation is additive: `InventoryReservation.reference`
continues to be the existing inventory-domain correlation field while
`OrderAllocation.reservationId` becomes the typed OMS ownership link. Existing
inventory records are neither reclassified nor modified.

## Validation and deployment plan

1. Run `pnpm prisma:validate` and `pnpm prisma:generate` after the schema
   edit.
2. Review the SQL migration for additive-only behavior.
3. Run it only through the Phase 07 disposable database preflight/migrate
   scripts.
4. Run persistence, concurrency, reconciliation, build, and E2E tests.
5. Preserve CI migration logs and database identity evidence without secrets.

## Rollback and forward-fix policy

An approved production migration is not rolled back through destructive table
or enum removal. If a defect is found, a new additive forward-fix migration is
created. Before a production deployment, operators must take a verified backup
and confirm the target schema belongs to Apple333; otherwise the deploy tooling
must stop and request approval.
