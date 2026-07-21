# Phase 06 — Database Design and Migration Report

**Status:** Schema and a reviewed additive migration are authored locally.
Prisma schema validation has passed. No migration execution, database
connection, seed, reset, `db push`, or production action has been performed
for Phase 06.

## Baseline and migration boundary

The only tracked migration is
`20260713000000_phase_04_1_pim_activation`. It is approved only as an
initial, additive baseline for a pristine, isolated PostgreSQL database. It
must never be edited. The current workstation has no approved Phase 06 target,
so this report authorizes design work only.

Existing inventory-adjacent models are:

| Existing model | Current role | Phase 06 decision |
| --- | --- | --- |
| `Branch` | Canonical store/central-stock entity with code, address, phone, `isActive`, and pickup state. | Extend compatibly; do not duplicate. |
| `BranchInventory` | Live branch/variant availability projection with `onHand` and `reserved`. | Retain unchanged until reconciliation/cutover. |
| `ProductSku` | One-to-one sellable SKU identity for a catalog variant. | Canonical inventory FK target. |
| `CatalogVariant` | PIM variant and legacy SKU display field. | Do not use as the inventory foreign key. |
| `AuditLog` | Generic transactional audit evidence. | Reuse with identifier-safe metadata. |
| `AdminUser.branchId` | Unconstrained branch scope string. | Keep as-is; do not add an FK without orphan preflight. |

## Proposed additive schema

### Enums

| Enum | Values |
| --- | --- |
| `BranchStatus` | `ACTIVE`, `DISABLED`, `ARCHIVED` |
| `WarehouseStatus` | `ACTIVE`, `DISABLED`, `ARCHIVED` |
| `InventoryLocationStatus` | `ACTIVE`, `DISABLED`, `ARCHIVED` |
| `InventoryLocationType` | `RECEIVING`, `STORAGE`, `PICKUP`, `QUARANTINE`, `DAMAGED` |
| `StockMovementType` | `PURCHASE`, `TRANSFER`, `ADJUSTMENT`, `RETURN`, `SALE_RESERVED` |
| `InventoryAdjustmentDirection` | `INCREASE`, `DECREASE` |
| `DeviceUnitStatus` | `AVAILABLE`, `RESERVED`, `SOLD`, `RETURNED`, `DAMAGED` |
| `InventoryReservationStatus` | `ACTIVE`, `RELEASED`, `EXPIRED`, `CANCELLED`, `FULFILLED` |
| `InventoryTrackingMode` | `NONE`, `SERIAL`, `IMEI`, `SERIAL_AND_IMEI` |

### Models and keys

| Model | Core fields | Integrity / indexes |
| --- | --- | --- |
| `Branch` extension | `status`, `warehouses` relation | Retain `isActive` as a compatibility field in this phase. |
| `Warehouse` | `branchId`, `code`, `name`, `status` | Unique `(branchId, code)`; branch is restrictive. |
| `InventoryLocation` | `warehouseId`, `code`, `name`, `type`, `status` | Unique `(warehouseId, code)` and composite warehouse ownership key. |
| `InventoryItem` | `warehouseId`, `locationId`, `skuId`, `quantity`, `reservedQuantity`, `availableQuantity`, `version` | Unique `(locationId, skuId)`; numeric check constraints; lookup indexes by SKU and warehouse. |
| `StockMovement` | `skuId`, optional source/destination location, quantity, type, adjustment direction, reference, idempotency key, actor, metadata | Immutable ledger; unique idempotency key; all historical product/location FKs restrict deletion. |
| `DeviceUnit` | `skuId`, optional inventory item, optional active reservation, normalized IMEI, normalized serial, status, warranty date | IMEI and serial unique when present; check that at least one identifier exists. |
| `InventoryReservation` | `inventoryItemId`, quantity, status, expiry, opaque reference, idempotency key, creator | Unique idempotency key; can own the exact tracked `DeviceUnit` rows in its hold with no order/payment relation. |
| `InventorySkuPolicy` | `skuId`, tracking mode | One policy per SKU; keeps physical tracking policy outside PIM. |

`availableQuantity` is intentionally stored because the phase contract requires
it, but it is never an independently writable business value. The migration
adds `availableQuantity = quantity - reservedQuantity` and non-negative check
constraints; inventory services recompute it in every transaction.

## Authored migration shape

The Phase 06 migration is tracked as:

```text
prisma/migrations/20260721000000_phase_06_inventory_multi_branch/migration.sql
```

It is additive:

1. Create the new enum types and tables.
2. Add nullable/default-backed `Branch.status` and reverse relations.
3. Add indexes, foreign keys, and PostgreSQL `CHECK` constraints.
4. Do **not** rename, drop, truncate, delete, reset, or alter
   `BranchInventory` destructively.
5. Preserve the existing `Branch.isActive` meaning by backfilling the new
   `Branch.status` to `ACTIVE` or `DISABLED`; it does not create stock,
   branches, warehouses, devices, or balances.

`prisma migrate diff --from-migrations` requires a Shadow Database and was
intentionally not pointed at any available database. The SQL was therefore
authored from the reviewed Prisma schema and manually checked for destructive
schema/data-removal statements. A generated diff and an isolated migration
application are still required before Phase 06 approval. `prisma migrate dev`,
`prisma db push`, and `prisma migrate reset` are not permitted against a
shared target.

## Compatibility and adoption plan

`BranchInventory` uses `variantId`, while canonical inventory uses `skuId`.
The only valid adoption route is:

```text
BranchInventory.variantId → ProductSku.variantId → InventoryItem.skuId
```

A later, separately reviewed, dry-run-only reconciliation tool may:

1. Require a declared warehouse/location mapping for each real branch.
2. Resolve every legacy `BranchInventory` row to a `ProductSku`.
3. Refuse and report unmapped variants, negative values, duplicates, or
   unexpected branch identities rather than inventing stock.
4. Create opening `ADJUSTMENT` movements and canonical balances only after an
   operator approves the reconciliation report.
5. Compare aggregate canonical branch/SKU balances with legacy branch/variant
   balances before a storefront read-path cutover.

No default warehouse, branch, device, or balance is created in a production or
shared environment by this phase. Test fixtures are isolated and clearly
marked only for disposable databases.

## PIM and lifecycle compatibility

The PIM variant-archive guard is extended to block a variant/SKU archive when
`BranchInventory`, a cart item, an inventory item, stock movement, device unit,
or reservation history exists. Historical relations use `RESTRICT`; disabling
or archiving is preferred over deletion.

New permissions also require a controlled, idempotent RBAC adoption step.
Adding permission codes in source or `prisma/seed.ts` does not grant them to an
existing deployment, and production policy prohibits automatic seeds.

## Required isolated database evidence before approval

1. A dedicated, loopback-only disposable PostgreSQL target with an explicit
   test role/database/schema identity.
   `docker-compose.inventory-test.yml` and `.env.inventory-test.example`
   provide the reviewed local-only topology; starting it remains an explicit
   operator action.
2. Read-only ownership and pristine/drift inspection before `migrate deploy`.
3. Reviewed migration SQL and checksum recorded as an artifact.
4. Migration application, `prisma migrate status`, generated-client validation,
   constraint/index inspection, and database tests.
5. Test-only fixture/reconciliation proof that never contacts production,
   shared staging, or a retained PIM benchmark database.
6. Backup/restore and rollback decision for any later existing-database
   adoption. Rolling back a data migration is never implemented by reset,
   truncation, or destructive SQL.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Legacy branch inventory lacks a SKU row. | Fail reconciliation and report it; do not infer a SKU. |
| `AdminUser.branchId` contains an orphan value. | Keep it unconstrained until preflight demonstrates zero orphan values. |
| A direct update bypasses the ledger. | No direct balance route; transaction-only service API, DB checks, audit, and idempotency. |
| Inventory data is deleted with a branch/SKU. | New historical FKs use `RESTRICT`; archive guards prevent destructive lifecycle changes. |
| Storefront availability is stale after a movement. | Commit-time cache invalidation/revalidation plus availability tests. |
| RBAC source code differs from deployed role rows. | Controlled idempotent RBAC adoption and before/after verification. |
