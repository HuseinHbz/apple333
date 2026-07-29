# Phase 07 API Contracts

All endpoints use the existing `{ success, data, meta }` envelope. Failures use
the same envelope with an OMS-specific code, a safe message, an optional field
map, and the request correlation ID. Inputs are Zod-validated; Prisma records
are mapped to explicit DTOs before leaving the server.

## Storefront

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/store/orders` | Requires `Idempotency-Key`, re-prices the cart server-side, reserves canonical inventory, and returns a safe order summary. |
| `GET` | `/api/store/orders` | Returns only current customer or current approved-guest orders. |
| `GET` | `/api/store/orders/[orderNumber]` | Ownership-checked detail projection. |
| `POST` | `/api/store/orders/[orderNumber]/cancel` | Ownership-checked cancellation request with a reason. |

## Administration

| Method | Path | Permission |
| --- | --- | --- |
| `GET` | `/api/admin/orders` | `orders.read` |
| `POST` | `/api/admin/orders` | `orders.create_admin` |
| `GET` | `/api/admin/orders/[id]` | `orders.read` |
| `POST` | `/api/admin/orders/[id]/confirm` | `orders.confirm` |
| `POST` | `/api/admin/orders/[id]/cancel` | `orders.cancel` / `orders.cancel_after_payment` |
| `POST` | `/api/admin/orders/[id]/allocate` | `orders.allocate` |
| `POST` | `/api/admin/orders/[id]/fulfillments` | `orders.fulfill` |
| `POST` | `/api/admin/orders/[id]/notes` | `orders.add_internal_note` |
| `GET` | `/api/admin/orders/[id]/timeline` | `orders.read` |

Common safeguards: strict page-size limits, stable ordering, same-origin checks
for mutations, actor/IP scoped rate limits, correlation IDs, authorization
before loading a sensitive projection, and no payment-card data.
