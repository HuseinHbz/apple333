# Phase 04 - Product Platform API Documentation

## Status and boundary

**Status: implemented application contract, migration pending.** The core
routes are implemented with the existing administrative route boundary,
permissions, Zod validation, audit context, rate limiting, and response
envelopes. Database persistence remains blocked until the additive migration
in [database-design.md](database-design.md) is reviewed and applied to an
isolated PostgreSQL environment.

Phase 03's public storefront API (`/api/store/*`) remains the active customer
contract. Phase 04 must evolve its source data behind compatibility projections;
it must not create a second public catalog or break existing storefront URLs.

No Prisma migration, `prisma db push`, seed, reset, or database data operation
has been performed for this plan. See [database-design.md](database-design.md).

## Platform conventions

Every implemented administrative endpoint must use the existing
`withAdminRoute` boundary:

- require a signed-in administrative actor;
- require the named RBAC permission;
- validate query strings and JSON bodies with strict Zod schemas;
- require same-origin requests for mutations;
- apply the existing request rate limit, audit context, structured logging, and
  `Cache-Control: no-store` response policy;
- return the existing envelope and `x-request-id` header.

Success envelope:

```json
{
  "success": true,
  "data": {},
  "meta": { "requestId": "uuid-or-client-request-id" }
}
```

Failure envelope:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "safe client message",
    "fields": { "title": "A product title is required." }
  },
  "meta": { "requestId": "uuid-or-client-request-id" }
}
```

The response uses the established error codes and HTTP status mapping; raw
database errors, import payloads, storage keys, and stack traces never leave
the server.

## Target administrative endpoints

| Route | Methods | Permission | Planned responsibility |
| --- | --- | --- | --- |
| `/api/admin/products` | `GET`, `POST` | `products.read`, `products.create` | Server-paginated product list; create a draft product only. |
| `/api/admin/products/[id]` | `GET`, `PATCH`, `DELETE` | `products.read`, `products.update`, `products.delete` | Read/update a governed product; archive/soft-delete instead of destructive deletion. |
| `/api/admin/products/[id]/publish` | `POST` | `products.publish` | Validate lifecycle gates and move `REVIEW` to `PUBLISHED`; record approval. |
| `/api/admin/products/[id]/variants` | `GET`, `POST` | `products.read`, `products.update` | Read/create product variants and their transitional SKU records. |
| `/api/admin/products/[id]/media` | `GET`, `POST`, `PATCH`, `DELETE` | `products.read`, `products.update`, `media.read` | Attach approved `MediaFile` records, set role/order/alt text; never accept arbitrary external URLs. |
| `/api/admin/products/[id]/seo` | `GET`, `PUT` | `products.read`, `products.update` | Governed canonical, metadata, schema data, and indexability settings. |
| `/api/admin/products/[id]/specifications` | `GET`, `PUT` | `products.read`, `products.update` | Set normalized attribute values after category validation. |
| `/api/admin/categories` | `GET`, `POST` | `categories.read`, `categories.create` | Nested category listing and draft-safe creation. |
| `/api/admin/categories/[id]` | `GET`, `PATCH`, `DELETE` | `categories.read`, `categories.update`, `categories.delete` | Update/order/soft-delete categories; reject unsafe parent cycles and deletion with live dependencies. |
| `/api/admin/brands` | `GET`, `POST` | `brands.read`, `brands.create` | Governed brand list/create; Apple is data, not a hard-coded special case. |
| `/api/admin/brands/[id]` | `GET`, `PATCH`, `DELETE` | `brands.read`, `brands.update`, `brands.delete` | Maintain brand state and safe logo-media reference. |
| `/api/admin/warranties` | `GET`, `POST` | `warranties.read`, `warranties.create` | Warranty provider/duration/terms lifecycle. |
| `/api/admin/warranties/[id]` | `GET`, `PATCH`, `DELETE` | `warranties.read`, `warranties.update`, `warranties.delete` | Update/archive a warranty without invalidating historical variant text. |
| `/api/admin/attributes` | `GET`, `POST` | `attributes.read`, `attributes.create` | Specification groups, attributes, and allowed values by category. |
| `/api/admin/attributes/[id]` | `GET`, `PATCH`, `DELETE` | `attributes.read`, `attributes.update`, `attributes.delete` | Governed attribute maintenance; reject removal when referenced. |
| `/api/admin/product-imports` | `GET`, `POST` | `product-imports.read`, `product-imports.create` | Create an uploaded/staged import batch; parse and validate only. |
| `/api/admin/product-imports/[id]` | `GET` | `product-imports.read` | Retrieve batch status, preview, row diagnostics, and audit-safe summary. |
| `/api/admin/product-imports/[id]/apply` | `POST` | `product-imports.apply` | Explicitly apply a validated batch using an idempotency key and change journal. |
| `/api/admin/product-imports/[id]/rollback` | `POST` | `product-imports.apply` | Compensate an eligible, unapplied-or-reversible batch from recorded changes; never delete unrelated catalog data. |

`[id]` route segments must be parsed through a shared ID validator. Every list
route must use bounded `page` and `pageSize` values, explicit sort keys, and
allow-listed filters; it must never accept arbitrary Prisma filters or order
objects.

## Implemented endpoint surface

| Route | Implemented methods | Permission boundary |
| --- | --- | --- |
| `/api/admin/products` | `GET`, `POST` | `products.read`, `products.create` |
| `/api/admin/products/[id]` | `GET`, `PATCH`, `DELETE` | `products.read`, `products.update`, `products.delete` |
| Product workflow routes | `POST` submit-review, publish, archive | `products.update`, `products.publish` |
| Product variants, specifications, and media | create/update/archive as applicable | `products.update`, `products.delete` |
| Brand/category/warranty resources | list/create/update/archive | their scoped RBAC permissions |
| Specification groups, attributes, values, category assignments | list/create/update/archive or assign | `attributes.*`, `categories.update` |
| `/api/admin/product-imports` | `GET`, `POST` | `product-imports.read`, `product-imports.create` |
| `/api/admin/product-imports/[id]` and `/apply` | `GET`, `POST` | `product-imports.read`, `product-imports.apply` |
| `/api/products`, `/api/products/[slug]`, `/api/categories` | `GET` | public compatibility aliases |

The legacy `/api/store/*` catalog contract remains active. The target table is
retained as a roadmap: unimplemented SEO resource routes, direct XLSX binary
parsing, and import rollback are not claimed by the implemented surface.

## Planned public PIM projection

The following public routes are the long-term normalized contract. They are not
available merely because they are listed here:

| Route | Method | Cache intent | Planned response boundary |
| --- | --- | --- | --- |
| `/api/products` | `GET` | Public, bounded cache | Published products only, validated filters, safe summary fields. |
| `/api/products/[slug]` | `GET` | Public, bounded cache | Published product detail, sellable variants, public specifications and media. |
| `/api/categories` | `GET` | Public, bounded cache | Active, public category tree only. |

Public projections must exclude: cost, barcode, supplier data, draft/review
state, approval identity, audit records, import source data, storage keys,
internal schema controls, and soft-deleted records. During the transition,
Phase 03 `/api/store/products`, `/api/store/categories`, and media routes stay
compatible and may be backed by the same PIM service after contract tests pass.

## Request shape requirements

### Product create/update

The body is intentionally allow-listed. It includes title, slug, short and full
description, category/brand references, lifecycle intent, variants, media
references, warranty reference, SEO, and normalized specifications. It must
reject unknown keys, duplicate variant option combinations, duplicate SKU or
barcode values, unapproved media IDs, and values outside the selected category
attribute schema.

Price and cost are sent as strings/decimal-safe values and converted by a
single domain boundary. JavaScript floating-point values must not become the
commercial source of truth.

### Import preview/apply

`POST /api/admin/product-imports` accepts a previously uploaded, validated
source file reference plus an explicit mapping/version. It does **not** accept
the raw CSV/XLSX contents as a blind catalog write. Apply requires the preview
revision, an idempotency key, and explicit confirmation that all blocking errors
are resolved.

## Compatibility and versioning

- Add fields additively and keep Phase 03 DTO fallbacks until a migration and
  data-quality review are approved.
- Use explicit response DTOs rather than returning Prisma records.
- Add a versioned route or opt-in field only for breaking public changes; do not
  silently change the meaning of existing Phase 03 fields.
- Document deprecation windows and contract-test results before retiring a
  storefront field or endpoint.

## Open implementation gates

Before any route in this document is marked available, the team must complete:

1. reviewed additive migration and a migration report;
2. service/repository implementation and audit-event handling;
3. authorization, validation, rate-limit, and error-contract tests;
4. public projection and cache-control tests;
5. API reference examples generated from the implemented Zod contracts.
