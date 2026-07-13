# Phase 04.1 — PIM performance report

## Status

Static query and index review is complete. Runtime measurements are pending an
isolated PostgreSQL execution; Docker and PostgreSQL client tooling are not
available on this workstation. No synthetic data was inserted into any
database.

## Query-path and index review

| Path | Existing support | Review result |
| --- | --- | --- |
| Public published product listing | `CatalogProduct(status, publishedAt)`, `(categoryId, status)`, `(brandId, status, publishedAt)` | Suitable starting indexes; verify with `EXPLAIN (ANALYZE, BUFFERS)` at 10k/100k rows. |
| Variant pricing/availability | `CatalogVariant(productId, isActive, sortOrder)`, `(isActive, priceRials)` | Suitable for product expansion and price filters. |
| SKU lookup | unique `ProductSku(code)` / `ProductSku(variantId)` and status indexes | Suitable for import conflict checks. |
| Category hierarchy | `CatalogCategory(parentId, sortOrder)` | Suitable for nested-category traversal. |
| Product media | `ProductMedia(productId, role, sortOrder)` | Suitable for hero/gallery selection. |
| Import rows | `ProductImportRow(importBatchId, status, rowNumber)` | Suitable for ordered bounded import apply. |
| Workflow/audit | `ProductWorkflowEvent(productId, createdAt)` | Suitable for per-product history. |

## Known performance risks

- `searchText` has no dedicated full-text or trigram index. Do not claim
  scalable free-text catalog search until a search strategy is approved.
- Each import apply is limited to 500 rows. Validation/import batches still
  need query-plan measurement and may need a reviewed chunking design if
  evidence shows a regression.
- Foreign-key and unique-index creation is safe only on a pristine baseline;
  a legacy migration would need lock-window and concurrent-index planning.

## Required isolated benchmark

After migration deployment to `apple333_pim_test`:

1. Generate 10,000 products with variants and representative category/brand
   cardinality using a dedicated non-production fixture.
2. Simulate 100,000 products only in a disposable database or CI artifact,
   never in a developer or shared database.
3. Capture `EXPLAIN (ANALYZE, BUFFERS)` for public list/detail/category,
   import SKU validation, and workflow-history queries.
4. Record p50/p95 response times, row counts, index usage, PostgreSQL version,
   fixture version, and hardware/runner details.
5. Open a separate optimization change if the measurements show sequential
   scans or an agreed latency target is exceeded.

No performance result is approved until those measurements are attached to the
Phase 04.1 release evidence.
