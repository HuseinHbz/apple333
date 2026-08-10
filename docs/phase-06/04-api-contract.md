# Phase 06 — Inventory API Contract

All mutable inventory endpoints use the existing `withAdminRoute` boundary:
Zod input validation, authenticated actor resolution, granular permission
checks, same-origin enforcement, rate limiting, request IDs, structured errors,
and transactional audit context. Responses use the existing envelope:

```json
{ "success": true, "data": {}, "meta": { "requestId": "..." } }
```

Failures contain `success: false`, a stable error code, safe client message,
and optional validation fields. Administrative responses have
`Cache-Control: private, no-store, max-age=0`.

## Administrative read endpoints

| Method / path | Permission | Input | Result |
| --- | --- | --- | --- |
| `GET /api/inventory` | `inventory.read` | `page`, `pageSize`, `branchId`, `warehouseId`, `locationId`, `sku`, `categoryId`, `availability`, `query` | Dashboard plus a paginated canonical location/SKU balance list. |
| `GET /api/inventory/:sku` | `inventory.read` | normalized SKU path | Up to 100 canonical balances for one SKU. |
| `GET /api/branches` | `branches.read` | bounded pagination | Branches visible to the actor's branch scope. |
| `GET /api/branches/:id/inventory` | `inventory.read` | branch CUID plus inventory filters | Canonical balances within that branch. |
| `GET /api/warehouses` | `warehouses.read` | bounded pagination, optional branch CUID | Warehouses and their physical locations. |
| `GET /api/imei` | `devices.read` | bounded pagination, SKU, branch, status, short identifier query | Masked device-unit rows only. |

## Administrative mutations

Every body is strict Zod input. The `idempotencyKey` must be 8–160 safe ASCII
characters. A replay returns the original committed state rather than creating
another movement, but only after the service reauthorizes the persisted
location or reservation against the current actor's branch scope.

| Method / path | Permission | Essential body | Ledger effect |
| --- | --- | --- | --- |
| `POST /api/branches` | `branches.create` | code, name, kind, status, address/pickup fields | Creates branch plus audit record. |
| `PATCH /api/branches/:id` | `branches.update` | changed branch fields | Updates state, invalidates public availability. |
| `POST /api/warehouses` | `warehouses.create` | branch, code, name, status, one or more locations | Creates warehouse/location aggregate plus audit record. |
| `PATCH /api/warehouses/:id` | `warehouses.update` | changed warehouse fields | Updates state, invalidates public availability. |
| `POST /api/inventory/receive` | `inventory.receive` | SKU, destination location, quantity, optional identifiers | `PURCHASE` movement and canonical balance increase. |
| `POST /api/inventory/adjust` | `inventory.adjust` | SKU, location, quantity, direction, required reason | `ADJUSTMENT` movement; tracked SKU adjustments are deliberately rejected. |
| `POST /api/inventory/transfer` | `inventory.transfer` | SKU, source/destination, quantity, optional device unit IDs | One atomic `TRANSFER`; tracked SKU requires exactly one selected available device unit per quantity. |
| `POST /api/inventory/sku-policy` | `inventory.policy.update` | SKU, tracking mode | Creates/updates the physical tracking policy. |
| `POST /api/inventory/reservations` | `inventory.reserve` | inventory item, quantity, opaque reference, optional tracked units | `SALE_RESERVED` movement and reservation foundation only. |
| `POST /api/inventory/reservations/:id/release` | `inventory.release` | idempotency key | Reverses the hold with a compensating `SALE_RESERVED` movement. |

Direct balance mutation has no route and no public repository API. The service
changes quantity only inside a serializable transaction that also writes the
movement, compatibility projection, and audit record.

## Public availability endpoint

`GET /api/inventory/:sku/availability` is deliberately public and rate-limited.
It returns only an overall band and branch identity/band:

```json
{
  "skuCode": "IPHONE-16-PRO-256",
  "availability": "LIMITED",
  "branches": [
    { "branchId": "…", "branchCode": "TEH-01", "branchName": "…", "availability": "LIMITED" }
  ]
}
```

It never returns exact count, warehouse/location, reservation, movement, IMEI,
serial number, warranty date, or audit information. It is no-store so a stock
write never acknowledges a stale public availability payload.

## Status and error semantics

| Code | Meaning |
| --- | --- |
| `VALIDATION_ERROR` | Strict schema, tracking policy, status, or active-location rule failed. |
| `UNAUTHENTICATED` / `FORBIDDEN` | Missing actor, permission, same-origin request, or branch scope mismatch. |
| `NOT_FOUND` | A required branch, location, SKU, balance, or reservation was not found. |
| `CONFLICT` | Duplicate code/identifier/idempotency collision, serializable retry conflict, invalid state transition, or insufficient available stock. |
| `RATE_LIMITED` | Per-actor/public request budget exceeded. |

There are no order, checkout, payment, installment, accounting, or ERP fields
in any Phase 06 request or response.
