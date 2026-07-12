# Phase 03 Storefront — Implementation Report

## Delivered scope

Phase 03 implements the customer-facing online storefront on
`feature/phase-03-storefront`:

- Responsive RTL home page with banner, featured products, new products,
  verified promotions, categories, and an honest placeholder for best sellers.
- Public catalog at `/catalog` and `/products`, with validated pagination,
  category, search, price, color, storage, availability, and sorting filters.
- Product page with media gallery/video playback, variant selection, server
  price, branch availability, specifications, comparison, FAQ, review state,
  trade-in status, installment status, and related products.
- Comparison workbench for two to four published products.
- Cookie-bound guest cart with server-side variant, price, publication, and
  availability validation; quantity update and removal are supported.
- Checkout review for delivery or a branch that can fulfil every cart line.
  It creates a trusted quote only; it never creates an order, payment, invoice,
  or inventory reservation.

## Public API surface

| Route | Responsibility |
| --- | --- |
| `GET /api/store/categories` | Public active categories |
| `GET /api/store/products` | Validated public catalog query |
| `GET /api/store/products/[slug]` | Published product detail |
| `GET /api/store/products/compare` | Comparison of 2–4 published products |
| `GET /api/store/media/[productId]/[mediaId]` | Public media only when attached to a published product |
| `GET /api/store/cart` | Private cookie-bound guest cart |
| `POST/PATCH/DELETE /api/store/cart/items…` | Safe cart mutations |
| `POST /api/store/checkout/quote` | Revalidated checkout preview |

All inputs are validated with Zod. Catalog responses are cacheable and cart/
quote responses are private and non-cacheable. The raw guest token is held only
in an `HttpOnly`, `SameSite=Lax` cookie; PostgreSQL stores its SHA-256 digest.

## Data-model status

The Prisma schema now contains additive catalog, product variant, product media,
branch, branch inventory, guest cart, and cart line models. Prisma validation
and client generation passed. No migration, database push, seed, reset, or
production database command was executed.

See [database-plan.md](database-plan.md) for the additive migration procedure.

## Intentional boundaries

These functions remain out of scope and are visibly marked unavailable rather
than simulated:

- Order creation, payment, invoice, shipment, refunds, and stock reservation
  (Phase 04).
- Installment approval/documents, wallet ledger, coupon/gift-card redemption,
  insurance pricing, and real shipping rates.
- Product review persistence and best-seller rankings, which require approved
  source data and completed-order data.

## Replacement note

The temporary Foundation homepage was removed so the App Router storefront owns
`/`. Health remains at `/api/health` and the management sign-in remains at
`/account/login`; no supported management route was removed.
