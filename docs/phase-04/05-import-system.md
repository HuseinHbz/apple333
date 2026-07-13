# Phase 04 - Product Import System

## Status and safety statement

**Implemented CSV staging foundation; XLSX adapter deferred.** CSV input is
parsed as bounded inert text, staged in an import batch, validated row by row,
and can be explicitly applied only when the batch is ready. It is never a
shortcut for blindly inserting supplier data into live product tables.

No import migration, seed, catalog update, data backfill, or rollback has been
run for Phase 04. The proposed schema is additive and still requires the review
procedure in [database-design.md](database-design.md).

## Supported source formats

| Format | Intended use | Requirements before parsing |
| --- | --- | --- |
| CSV (UTF-8) | Controlled supplier/catalog exports | Delimiter/encoding detection, bounded size, header mapping, formula-safe values. |
| XLSX | Curated operational import | Workbook/worksheet selection, bounded rows/columns, no macro execution, formula values treated as data only. |

The current administration page implements the CSV path. `XLSX` remains a
validated API/source-format contract only; binary workbook parsing is deferred
until an approved parser dependency and storage-reader boundary are available.

Legacy spreadsheet formats, arbitrary JSON, ZIP archives, and images are out
of scope unless separately approved and threat-modelled.

## Target data boundaries

An import can propose changes to:

- brands and nested categories;
- draft products and lifecycle-safe product fields;
- variants, option combinations, and SKU metadata;
- normalized specification values;
- warranty references;
- SEO metadata and public media *references*.

It cannot directly mutate branch stock, cart lines, orders, payments, invoices,
or audit history. A spreadsheet may reference an existing approved media ID;
it must not turn a supplier URL into a public asset automatically.

## Planned import lifecycle

```text
UPLOADED -> PARSING -> VALIDATING -> PREVIEW_READY
                                      |             |
                                      |             +-> REJECTED / EXPIRED
                                      v
                                  APPLYING -> APPLIED
                                      |
                                      +-> APPLY_FAILED -> recover or rollback review
```

1. An authorized user uploads a source through the existing media/storage
   boundary and creates an import batch.
2. The service validates file size, type, extension, row/column limits, and
   a declared template version before parsing.
3. A parser converts each row into a canonical, typed staging record. It
   preserves source row number but does not persist raw secrets or arbitrary
   file formulas in public fields.
4. Validation resolves brand/category/warranty/attribute references, checks
   slugs and SKU/barcode uniqueness, validates option combinations, and
   separates blocking errors from warnings.
5. The caller receives a preview: insert/update/skip counts, per-row errors,
   normalized values, collisions, and a signed preview revision.
6. Only `product-imports.apply` may apply a `PREVIEW_READY` batch. It requires
   explicit confirmation, the current preview revision, and an idempotency key.
7. Application proceeds in bounded transactions. Each effective change is
   recorded in a change journal with the prior state necessary for recovery.
8. The batch ends as `APPLIED`, `APPLY_FAILED`, or a reviewed compensated state;
   it is never silently retried after uncertain partial success.

## Canonical template

A versioned template should use one primary `products` sheet/table and optional
related sheets for variants and specifications. Minimum columns:

| Domain | Example columns |
| --- | --- |
| Product | `external_id`, `title`, `slug`, `brand_slug`, `category_slug`, `status`, `short_description` |
| Variant | `product_external_id`, `sku`, `barcode`, `storage`, `color`, `region`, `model_number`, `price_rials`, `cost_rials` |
| Specification | `product_external_id`, `variant_sku`, `attribute_code`, `value` |
| SEO | `product_external_id`, `meta_title`, `meta_description`, `canonical_path`, `indexable` |
| Media reference | `product_external_id`, `media_id`, `role`, `sort_order`, `alt_text` |

The implemented mapping must explicitly define whether `external_id` is an
upsert key, and must reject ambiguous rows. Title, slug, and SKU are not safe
substitutes for one another.

## Validation matrix

| Check | Blocking? | Notes |
| --- | --- | --- |
| File size/type/template version | Yes | Reject before parser allocation becomes unbounded. |
| Required headers and row shape | Yes | Missing/duplicate headers prevent preview. |
| Slug/SKU/barcode uniqueness | Yes | Validate both inside the file and against active data. |
| Category/brand/warranty lookup | Yes | Unknown reference must be resolved explicitly, not auto-created by typo. |
| Variant option combination | Yes | One product cannot contain duplicate sellable combinations. |
| Price/cost representation | Yes | Decimal-safe/non-negative policy; no locale-dependent floating-point parse. |
| Specification attribute/value | Yes | Must be valid for the target category/value type. |
| Media attachment | Yes | Existing, approved, non-deleted media only. |
| SEO length/canonical policy | Warning or blocking by policy | Must be visible in preview. |
| Archived/no-op target | Warning | Requires explicit row action and audit evidence. |

## Apply and rollback strategy

The system uses **compensating records**, not a destructive database restore:

- The apply operation writes an immutable batch and per-row change journal.
- Every changed entity records enough previous safe state to restore that
  change only when no later conflicting change has occurred.
- Rollback is denied when a later manual edit, publication transition, order,
  or inventory dependency makes compensation unsafe; it escalates to an
  operator review instead.
- Soft-delete/archival is preferred to hard deletion for accidentally imported
  products.
- Failed batches expose row-level failure evidence and do not claim atomic
  success unless the transaction boundary actually guarantees it.

## Authorization, audit, and observability

- `product-imports.create` creates/uploads/previews batches.
- `product-imports.read` views only permitted batch metadata and diagnostics.
- `product-imports.apply` confirms an apply or reviewed rollback.
- Every action records actor, request ID, source checksum, template version,
  mapping revision, row counts, outcome, and safe error codes.
- Metrics include parse duration, validation error rate, applied/failed rows,
  rollback attempts, and time spent in each batch status.

## Acceptance criteria before enablement

1. Parser fuzz/limit tests and spreadsheet formula-injection tests pass.
2. Preview and apply work against a disposable PostgreSQL database with a
   reviewed additive migration.
3. Duplicate SKU, concurrency, idempotency, partial failure, and rollback
   scenarios have integration coverage.
4. An operator can download or view a safe error report without seeing secrets
   or internal storage paths.
5. A dry-run and a limited staged pilot are approved before production use.
