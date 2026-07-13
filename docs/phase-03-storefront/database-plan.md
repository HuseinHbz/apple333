# Phase 03 Storefront — Additive Database Plan

**Branch:** `feature/phase-03-storefront`
**Status:** Additive Prisma schema implemented and validated. No migration, database
write, seed, or deployment command has run.

## Objective

Add the minimum trusted catalog and availability model needed by the customer
storefront without leaking Phase 4 order/payment responsibilities into this
phase.

## Additive entities

| Entity | Purpose | Phase 03 use |
| --- | --- | --- |
| `CatalogCategory` | Public Apple category hierarchy | Home and catalog navigation/filtering |
| `CatalogProduct` | Published product family and SEO/specification data | Home, catalog, product page, compare |
| `CatalogVariant` | Purchasable SKU, color/storage/region/warranty and canonical price | Variant selection, cart lines, quote |
| `ProductMedia` | Ordered link from product to governed `MediaFile` | Product gallery/video metadata |
| `Branch` | Store/central-stock location | Click & Collect availability |
| `BranchInventory` | Per-branch on-hand and reserved quantity for a variant | Availability and checkout quote only |
| `StorefrontCart` / `StorefrontCartItem` | Durable guest-cart model | Cookie-bound guest cart; no order or stock reservation |

## Safety and boundaries

- All new tables are additive. No existing model, field, primary key, or data is
  removed or rewritten.
- Price is represented as `BigInt` rials and serialized through allow-listed
  DTOs; the client never supplies a trusted amount.
- Available quantity is derived as `onHand - reserved`; Phase 03 performs no
  reservation or decrement. Phase 4 owns atomic reservation, order creation,
  payment, and allocation.
- A public quote validates variant existence, activity, publication, requested
  branch, and requested quantity. It explicitly is **not** a payment, order,
  or stock reservation.
- Guest cart identity is an opaque, `HttpOnly`, `SameSite=Lax` cookie. Only its
  SHA-256 digest is persisted; no raw guest token is stored in PostgreSQL.
- Adding or changing a cart line rechecks published status, active variant,
  server-side price, and available quantity. A cart still does **not** reserve
  stock; Phase 4 will revalidate it atomically during order creation.

## Migration procedure (not executed)

1. Review generated Prisma SQL against a disposable PostgreSQL instance.
2. Confirm indexes, foreign keys, bigint serialization, and catalog slug/SKU
   uniqueness.
3. Apply a reviewed additive migration only in development/staging.
4. Seed approved catalog/branch data through a separately reviewed import; do
   not invent or publish business prices.
5. Run API, quote, storefront, and concurrency tests before rollout.

Forbidden: `prisma db push` against a shared environment, reset, drop,
truncate, migration of production data, or seeding production from demo data.
