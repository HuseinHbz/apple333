# Phase 07 API Contracts

All endpoints use the existing application response envelope. Inputs are
strictly Zod-validated, routes use the existing same-origin/rate-limit/correlation
boundary, and Prisma records are mapped to explicit DTOs before they leave the
server. There is no OMS guest-order API: checkout requires an authenticated
customer, although an existing guest-cart token may be correlated to the cart.

## Idempotency contract

Every state-changing OMS request includes an `idempotencyKey` in its JSON body.
The body field is canonical. Interactive clients may also send an
`Idempotency-Key` header for their own correlation, but the current route
contract does not read or trust that header. A key is scoped to the actor and
operation. Replaying the same key with the same request hash returns the durable
result; reusing it with different content fails safely.

## Storefront

| Method | Path                                     | Contract                                                                                                                    |
| ------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/store/orders`                      | Authenticated customer’s own paginated history only.                                                                        |
| `POST` | `/api/store/orders`                      | Converts the current customer cart, re-prices on the server, reserves canonical inventory, and returns the created order.   |
| `GET`  | `/api/store/orders/[orderNumber]`        | Ownership-checked customer detail.                                                                                          |
| `POST` | `/api/store/orders/[orderNumber]/cancel` | Ownership-checked cancellation while policy permits it; `reasonCode`, `expectedVersion`, and `idempotencyKey` are required. |

Customer responses may include the customer’s own immutable pricing and address
snapshots, but never internal notes, audit records, provider references,
administrative allocation data, or full IMEI/serial values.

## Administration

| Method | Path                                  | Permission                                                                                                                        |
| ------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/admin/orders`                   | `orders.read`                                                                                                                     |
| `POST` | `/api/admin/orders`                   | `orders.create_admin`                                                                                                             |
| `GET`  | `/api/admin/orders/[id]`              | `orders.read`                                                                                                                     |
| `POST` | `/api/admin/orders/[id]/confirm`      | `orders.confirm`                                                                                                                  |
| `POST` | `/api/admin/orders/[id]/cancel`       | `orders.cancel` or `orders.cancel_after_payment` as enforced by service policy                                                    |
| `POST` | `/api/admin/orders/[id]/allocate`     | `orders.allocate`                                                                                                                 |
| `POST` | `/api/admin/orders/[id]/fulfillments` | `orders.fulfill`                                                                                                                  |
| `POST` | `/api/admin/orders/[id]/payment`      | `orders.view_financials`                                                                                                          |
| `POST` | `/api/admin/orders/[id]/notes`        | Route `orders.read`; service requires `orders.add_internal_note` for internal notes or `orders.update` for customer-visible notes |
| `GET`  | `/api/admin/orders/[id]/timeline`     | `orders.read`                                                                                                                     |

`POST /api/admin/orders/[id]/fulfillment` remains a backwards-compatible alias
for the plural fulfillment endpoint. It is deprecated in favour of
`/fulfillments`.

## Field-level projection policy

- `orders.view_financials` is required for administrative money values and
  payment attempts. Without it, financial DTO fields are `null` or omitted.
- `orders.view_customer_pii` is required for administrative customer PII
  projections. A correlated PII-view audit record is written before returning
  the projection.
- `orders.view_imei` is required for full tracked-device IMEI/serial values.
  Without it, allocation device-unit arrays are empty.
- Route permissions do not replace application-service checks. Service methods
  reapply ownership, branch, and field-permission policy before accessing or
  changing an aggregate.

## Input and error boundaries

- All request schemas are `.strict()`; client totals, catalog names, inventory
  identifiers, lifecycle status, and device IDs are not accepted as trusted
  order-creation input.
- Mutating commands use an `expectedVersion` to prevent stale lifecycle writes.
- Cancellation/rejection requires a bounded `reasonCode`; notes are bounded,
  treated as sensitive content, and require an `idempotencyKey`.
- Page size and filters are validated server-side. List sort remains stable.
- Payment-gateway settlement, cardholder data, refunds, courier operations,
  and accounting posting are not API capabilities of Phase 07.
