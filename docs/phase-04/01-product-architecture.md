# Phase 04 — Apple Product Platform Architecture

## Purpose

This phase turns the existing storefront catalog into the governed Product
Information Management (PIM) source of truth for Apple333. It does **not**
create a second Product, Category, Variant, or Media system.

The existing Phase 03 aggregates remain canonical:

```text
Brand
  └─ CatalogCategory
       └─ CatalogProduct
            └─ CatalogVariant
                 └─ ProductSku (one-to-one PIM/commercial record)
                      └─ BranchInventory (existing inventory boundary)
```

`CatalogCategory`, `CatalogProduct`, `CatalogVariant`, `ProductMedia`, and
`MediaFile` are extended in place. Storefront, cart, and inventory foreign keys
continue to use their current identifiers and relations.

## Bounded contexts

| Context | Ownership | Phase 04 responsibility |
| --- | --- | --- |
| PIM | Catalog aggregate | Product lifecycle, variants, SKU metadata, specifications, SEO, import staging |
| Media | Existing `MediaFile` / `ProductMedia` | Product image/video association, ordering, alt text, safe visibility |
| Storefront | Existing `/api/store/*` | Published, allow-listed product projection only |
| Inventory | Existing `BranchInventory` | Availability only; no stock mutation in this phase |
| Pricing | Existing variant price | Compatibility read/write; pricing engine remains a later bounded context |
| Orders | Future | No order, payment, reservation, or fulfillment is created here |

## Lifecycle

```text
DRAFT → REVIEW → PUBLISHED → ARCHIVED
          ↑         │
          └─────────┘  (content correction / re-review)
```

- A product is created as `DRAFT`.
- Only a valid product with a sellable variant/SKU may move to `REVIEW`.
- `PUBLISHED` requires explicit approval and a unique published slug.
- `ARCHIVED` is a reversible visibility state, not a hard delete.
- All product, category, brand, specification, SEO, media, and import
  mutations write an audit event.

## Compatibility rules

1. `CatalogProduct.brand` remains a string fallback while `brandId` is
   introduced and backfilled.
2. `CatalogVariant.sku`, `warranty`, `priceRials`, and JSON attributes remain
   compatible storefront fields. The normalized records are dual-written by
   PIM services until a reviewed future migration removes legacy fields.
3. `ProductMedia` plus `MediaFile` remain the only media source. Image/video
   distinction comes from `MediaFile.kind`; no duplicate ProductImage or
   ProductVideo tables are introduced.
4. `BranchInventory` and cart lines remain attached to `CatalogVariant` during
   this phase. ProductSku is a PIM/commercial record, not an inventory FK
   migration.
5. Public API projections expose only published products and safe fields. Cost,
   barcode, import payloads, audit data, internal SEO controls, and drafts are
   never public.

## Search preparation

The product service produces an explicit search projection from title, slug,
brand, SKU code, category path, and normalized specifications. It is stored as
application-ready data/DTO fields only; OpenSearch or Elasticsearch is not
introduced in this phase.

## Scale and performance

- Admin lists are server-paginated and filterable; no product collection is
  loaded into the browser.
- Product summaries use narrow Prisma selects; detail routes use explicit
  projections.
- Slugs, SKU codes, barcodes, lifecycle status, brand/category, and
  specification lookup keys are indexed.
- Import is staged, validated, and applied transactionally in bounded batches;
  it never writes raw uploaded data directly to live catalog tables.

## Phase numbering note

Earlier roadmap notes call order/payment work “Phase 4”. This implementation
follows the user-approved **Phase 04 Apple Product Platform** brief and keeps
order/payment scope out of this PIM module. Existing `docs/phase-4/` material
is left untouched.
