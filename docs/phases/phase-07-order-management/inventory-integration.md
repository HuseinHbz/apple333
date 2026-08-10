# Phase 07 Inventory Integration

## Source of truth and transaction boundary

`InventoryItem` and `DeviceUnit` remain canonical. `BranchInventory` may guide
availability display but never authorizes an OMS allocation on its own.

```text
validated cart/admin intent
  -> server pricing and immutable snapshots
  -> choose one eligible branch
  -> reserve InventoryItem and (when tracked) DeviceUnit rows
  -> persist Order, items, allocations, device assignments, history, audit, outbox
  -> mark source cart converted / revalidate storefront inventory
```

Creation, allocation, reservation, audit, history, and outbox work run in the
same serializable PostgreSQL transaction. A committed order cannot exist
without its required reservation/allocation evidence.

## Allocation policy

1. Pickup uses the selected active pickup branch.
2. Delivery chooses an active branch that can satisfy every line.
3. Version 1 is complete single-branch allocation; implicit split allocation
   is not enabled.
4. An admin/branch actor is checked against the target allocation branch before
   a new order or inventory reservation is written.
5. Tracked SKUs choose server-side available `DeviceUnit` rows for the selected
   inventory item. Client-provided IMEI/serial values are never trusted.

## Durable tracked-device evidence

Each tracked reservation creates `OrderDeviceAssignment` rows connected to the
order, item, allocation, reservation, and `DeviceUnit`. The assignment stores
an IMEI/serial snapshot and is retained after release or fulfillment:

| Inventory outcome        | Device unit | Assignment outcome |
| ------------------------ | ----------- | ------------------ |
| Active order reservation | Reserved    | `RESERVED`         |
| Cancellation or expiry   | Available   | `RELEASED`         |
| Delivered fulfillment    | Sold        | `FULFILLED`        |

The active-assignment partial unique index is designed to prevent a single
tracked unit from being reserved for two active orders. Full IMEI/serial values
are returned only with `orders.view_imei`.

## Release and consumption

- Cancellation and expiry release active inventory reservations, return tracked
  device units, mark assignments `RELEASED`, and create inverse reservation
  movements.
- Delivered fulfillment consumes the reservation (`FULFILLED` in the Phase 06
  inventory enum), records `SALE_FULFILLED`, marks device units sold, and marks
  assignments `FULFILLED`.
- Reconciliation checks allocation/reservation linkage, tracked-assignment
  quantity/status, released-allocation consistency, and fulfillment drift. It
  is read-only.

The expiry command is callable for guarded test/operations use. A recurring
production worker remains outside Phase 07 and requires separate approval.
