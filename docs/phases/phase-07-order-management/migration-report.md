# Phase 07 Migration Report

**State: implemented and statically validated; not applied locally or to any
production/shared database.**

## Safety declaration

- Production or shared database access: prohibited.
- Migration style: additive only.
- Existing migrations: immutable.
- Destructive statements (`DROP`, `TRUNCATE`, reset, or data rewrite): not
  permitted.
- Validation target: an owned, disposable PostgreSQL database guarded by
  `NODE_ENV=test`, `APPLE333_TEST_DB=1`, and `APPLE333_ORDER_TEST_DB=1`.

## Existing schema dependencies

Phase 07 references, without reclassifying existing records:

- `User`, `Address`, `CatalogProduct`, `CatalogVariant`, and `ProductSku` for
  immutable snapshots and historical references.
- `Branch`, `Warehouse`, `InventoryItem`, `InventoryReservation`, and
  `DeviceUnit` for allocation, reservation, and IMEI/serial evidence.
- `StorefrontCart` and `StorefrontCartItem` for checkout conversion.
- `AuditLog` for correlated, redacted audit evidence.

## Implemented additive database objects

`prisma/migrations/20260729000000_phase_07_order_management/migration.sql`
introduces the following additive objects:

- `OrderSource`, `OrderType`, `OrderStatus`, `OrderPaymentStatus`,
  `OrderAllocationStatus`, `OrderFulfillmentStatus`, `OrderFulfillmentMethod`,
  `OrderNoteVisibility`, `OrderActorType`, `OrderEventStatus`, and
  `OrderDeviceAssignmentStatus`.
- `Order` with immutable customer/address snapshots, server-calculated integer
  totals, status dimensions, optimistic `version`, and a unique order number.
- `OrderItem` with immutable product/variant/SKU/warranty/attributes snapshots.
- `OrderAllocation` linked to an order item, branch/warehouse, inventory item,
  and `InventoryReservation`.
- `OrderPayment`, `OrderFulfillment`, `OrderStatusHistory`, `OrderNote`,
  `OrderIdempotencyRecord`, and `OrderOutboxEvent`.
- `OrderDeviceAssignment`, which durably links a tracked `DeviceUnit` to an
  order, item, allocation, and reservation with IMEI/serial snapshots and
  `RESERVED`, `RELEASED`, or `FULFILLED` evidence state.

The migration also adds `StockMovementType.SALE_FULFILLED`,
`StorefrontCartItem.unitPriceRials`, `UserProfile.passwordHash`, audit-log
snapshot/actor/reason columns, and `OrderOutboxEvent.occurredAt`. It does not
edit an existing migration.

## Integrity constraints and indexes

The reviewed SQL provides:

- a unique `Order.orderNumber`;
- a unique `(scope, key)` order-idempotency pair;
- unique non-null payment provider references;
- checks for positive item/allocation quantities and non-negative money
  components;
- foreign keys with `RESTRICT`, `SET NULL`, or aggregate-safe `CASCADE`
  behavior;
- indexes for customer history, lifecycle/status searches, source, timeline,
  allocation/fulfillment lookups, and standalone `Order.createdAt` ordering;
- a partial unique index preventing one active tracked-device assignment
  (`RESERVED`) from being claimed by multiple orders, while allowing a released
  unit to be assigned later.

## Validation record and deployment plan

- `pnpm prisma:validate`: passed locally after the schema edit.
- `pnpm prisma:generate`: passed locally after the schema edit.
- SQL review: additive-only; no `DROP`, `TRUNCATE`, reset, or existing-migration
  rewrite is present.
- Application: **not run locally**, because the guarded disposable Docker
  PostgreSQL environment is unavailable on this workstation.

Before any deployment, run only through the Phase 07 guarded preflight/migrate
scripts against an owned, disposable database. Preserve CI migration logs and
sanitized database-identity metadata. Static Prisma validation is not proof
that the migration applies to PostgreSQL.

## Rollback and forward-fix policy

An approved production migration is not rolled back through destructive table
or enum removal. If a defect is found, create a reviewed additive forward-fix
migration. Before a production deployment, operators must take a verified
backup and confirm the target schema belongs to Apple333; otherwise deployment
tooling must stop and request approval.
