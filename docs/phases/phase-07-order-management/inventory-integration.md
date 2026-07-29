# Phase 07 Inventory Integration

## Source of truth

`InventoryItem` and `DeviceUnit` are canonical. `BranchInventory` is a
sellable projection and may be used to guide a storefront quote but never to
approve an order allocation.

## Transaction boundary

```text
validate cart + snapshot
  → choose one eligible branch (SINGLE_BRANCH_FIRST)
  → reserve canonical InventoryItem rows
  → reserve tracked DeviceUnit rows when required
  → create Order, items, allocations, history, audit, outbox
  → mark source cart converted
  → synchronize BranchInventory projection
```

The complete sequence runs in one serializable PostgreSQL transaction. Existing
Phase 06 standalone reservation HTTP/API flows remain available; Phase 07 uses
transaction-aware inventory primitives so an order cannot commit without its
reservation and an outbox event cannot exist without its aggregate change.

## Allocation policy

1. Pickup uses the selected active pickup branch.
2. Delivery selects the first active branch that can satisfy every line.
3. A branch allocation must be complete for every order line in v1.
4. Cross-branch/split allocations are feature-flagged off; no implicit split
   is performed.
5. Tracked SKUs select server-side `AVAILABLE` device units from the chosen
   inventory item. Full IMEI/serial values remain internal.

## Release and consumption

- Cancellation releases active reservations, reserved balances, and tracked
  device units; it writes an inverse reservation movement and reconciles the
  branch projection.
- Terminal fulfillment consumes the reservation, reduces physical quantity,
  marks device units `SOLD`, and synchronizes the projection.
- Expiration/reconciliation tooling runs only in the disposable test
  environment until a separately approved production worker exists.
