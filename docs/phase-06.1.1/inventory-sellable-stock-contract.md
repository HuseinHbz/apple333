# Phase 06.1.1 — Inventory Sellable-Stock Contract

**Status:** Implemented against local isolated test code only. No production
database, credentials, deployment target, or schema migration was used.

## Decision

`InventoryItem` is the physical source of truth. It records stock at every
location, including receiving, quarantined, and damaged stock. Its
`availableQuantity` remains physical unreserved quantity:

```text
availableQuantity = quantity - reservedQuantity
```

`BranchInventory` is the transactional **sellable-stock projection** by
branch and catalog variant:

```text
onHand   = sellable physical quantity
reserved = active sellable holds
sellable available = onHand - reserved
```

It is not a second physical ledger and must exclude non-sellable stock.

## Eligibility

An item contributes to `BranchInventory` and public availability only when:

| Condition | Required value |
| --- | --- |
| Location type | `STORAGE` or `PICKUP` |
| Location status | `ACTIVE` |
| Warehouse status | `ACTIVE` |
| Branch status | `ACTIVE` |
| Branch active flag | `isActive = true` |

`RECEIVING`, `QUARANTINE`, and `DAMAGED` remain physical evidence but
contribute zero sellable stock. New reservations are rejected for those
locations. Releases recalculate the projection from the physical balance,
rather than applying a potentially stale decrement.

## Transaction protocol

All inventory writes use the existing serializable transaction. After receipt,
adjustment, transfer, reservation, or release, the affected branch/variant is
aggregated from `InventoryItem` and upserted into `BranchInventory` in the same
transaction. This prevents delta-sign errors across sellable and non-sellable
locations.

Branch and warehouse status changes rebuild all affected branch projections in
the same transaction. A future location status/type endpoint must invoke the
same rebuild. Zero projection rows are retained instead of deleted, providing
a stable branch/variant coordinate while stock is temporarily non-sellable.

## Read-only reconciliation

`scripts/reconcile-branch-inventory.mjs` groups all physical inventory by
branch and variant, but calculates canonical `onHand` and `reserved` using the
eligibility rules above. Non-sellable physical stock therefore reconciles as
canonical `0/0`; a non-zero projection for it is real drift. A direct fixture
that bypasses synchronization is also reported as drift rather than hidden.

The command remains read-only and guarded to the isolated Phase 06 test
database.

## Rollout gate

Historical `BranchInventory` rows may use the old physical-stock semantics.
Before a production rollout, an explicitly authorized operator must run a
read-only reconciliation/dry-run, resolve mismatches, run a reviewed
transactional snapshot backfill, and reconcile again. This phase neither
accesses nor changes production data and authorizes no automatic backfill.

## Known boundary

There is no inspection/repair transition for a `DeviceUnit` already marked
`DAMAGED`; tracked-device transfer intentionally accepts only `AVAILABLE`
units. A later repair workflow must handle physical recovery. The existing
admin dashboard `availableQuantity` remains a physical unreserved metric and
must not be presented as storefront sellable availability.
