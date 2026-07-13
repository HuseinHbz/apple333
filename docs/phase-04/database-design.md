# Phase 04 — Safe Additive Database Design

**Status:** Design and Prisma validation only. No migration, database push,
seed, reset, drop, truncate, or production database command has been run.

## Existing source-of-truth models

The following Phase 03 models are already referenced by storefront, cart, and
inventory and must be preserved:

- `CatalogCategory`
- `CatalogProduct`
- `CatalogVariant`
- `ProductMedia` and `MediaFile`
- `BranchInventory`
- `StorefrontCartItem`

Phase 04 extends them additively. It must not rename or replace them with a
parallel `Product`, `ProductVariant`, `Category`, `ProductImage`, or
`ProductVideo` system.

## Planned additive changes

| Entity | Change | Compatibility rule |
| --- | --- | --- |
| `Brand` | New governed brand record | `CatalogProduct.brand` remains the public fallback until backfill |
| `CatalogCategory` | Add SEO, optional media reference, soft-delete metadata | Existing `imageUrl` remains valid |
| `CatalogProduct` | Add nullable `brandId`, review/approval data, import/search metadata, soft-delete metadata | Existing name, summary, SEO fields, JSON specs, and product IDs remain |
| `CatalogVariant` | Add model-number, nullable warranty relation, option key, SKU relation | Existing SKU, price, attributes, and inventory/cart FKs remain |
| `ProductSku` | New one-to-one commercial/SKU record | Does not retarget inventory/cart in this release |
| `Warranty` | New governed warranty record | Existing warranty text remains fallback |
| `SpecificationGroup`, `ProductAttribute`, `AttributeValue`, `ProductSpecification` | New normalized specification engine | Existing JSON data is retained until verified mapping |
| `ProductSeo` | New one-to-one advanced SEO record | Existing SEO title/description remain fallback |
| `ProductImportBatch`, `ProductImportRow` | Staged preview, errors, apply/rollback evidence | Never imports into catalog without validation |
| `ProductMedia` | Add timestamps and optional variant association if needed | Unified image/video source remains `MediaFile` + `ProductMedia` |

## Required constraints and indexes

- Case-normalized unique Brand `slug` and `name`.
- Existing globally unique category/product slugs and variant SKU remain.
- Product SKU `code` unique; barcode unique only when present.
- `ProductSku.variantId` unique for the one-to-one transitional relation.
- Specification group/attribute/value codes unique within their appropriate
  scope; specifications uniquely identify their target product/variant and
  attribute in service validation.
- Index product list filters by `brandId`, `categoryId`, `status`, and
  `publishedAt`; index variants by product and option key.
- Index import batch status and import rows by batch/status/row number.

PostgreSQL-only checks (for example, non-negative price/cost and a single HERO
media row) require reviewed SQL. They are not silently emulated in application
code or applied in an unreviewed migration.

## Migration procedure — not executed

1. Capture database backup/restore evidence and inspect schema drift.
2. Establish the Phase 03 schema baseline if the target environment has no
   Prisma migration history.
3. Generate an additive Phase 04 migration on a disposable PostgreSQL database.
4. Review generated SQL, enum lock behavior, index strategy, foreign keys, and
   rollback plan.
5. Apply only nullable columns/new tables first in development/staging.
6. Backfill Apple brand, warranty, SEO, SKU, and specifications in audited,
   restartable batches with row counts and errors.
7. Deploy dual-read/dual-write PIM services while storefront contracts retain
   legacy fallbacks.
8. Add stricter constraints/indexes only after a data-quality report passes.
9. Defer legacy field removal and inventory/cart FK migration to a later,
   explicitly approved release.

## Explicitly forbidden

- `prisma migrate reset`
- `prisma db push` against shared or production databases
- destructive migrations, table drops, truncation, or deletion of catalog data
- automatic import into live catalog tables without preview validation
