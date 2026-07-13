# Phase 04.1 — PIM migration review

## Decision

`20260713000000_phase_04_1_pim_activation` is approved **only as the initial,
add-only baseline for a pristine and isolated PostgreSQL database** named
`apple333_pim_test` (or a disposable CI equivalent). It is not approved for a
shared, production, unknown, or already-populated database.

The repository has no tracked Prisma migration history. Consequently, this is
not a narrow Phase 04 delta: it creates the complete accumulated platform
schema. A separate adoption plan, database ownership proof, drift report, and
staged backfill design are required before any existing database can be
considered.

## Evidence reviewed

- Schema: `prisma/schema.prisma`
- Existing migration folders: none before this change
- Phase 04 completion report: `docs/phase-04/09-phase-completion-report.md`
- Offline SQL source: `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`

The diff command used an inert loopback URL for schema parsing only. It did not
connect to PostgreSQL, create a shadow database, or mutate a database.

## Current Prisma baseline

| Item | Count / finding |
| --- | --- |
| Models | 38 |
| Enums | 18 |
| Existing migration history | None |
| Generated baseline operations | 18 enum types, 38 tables, 96 indexes, 50 foreign-key constraints |
| Destructive SQL | None |

## Phase 04 model mapping

| Brief name | Prisma model | Change class |
| --- | --- | --- |
| Brand | `Brand` | Add table |
| Category extensions | `CatalogCategory` | Add columns/relations/indexes in a legacy adoption; included in baseline table creation |
| Product | `CatalogProduct` | Add columns/relations/indexes in a legacy adoption; included in baseline table creation |
| Product variant | `CatalogVariant` | Add columns/relations/indexes in a legacy adoption; included in baseline table creation |
| SKU | `ProductSku` | Add table |
| Warranty | `Warranty` | Add table |
| Specification group | `SpecificationGroup` | Add table |
| Specification attribute | `ProductAttribute` | Add table |
| Specification value | `AttributeValue` | Add table |
| Product specification | `ProductSpecification` | Add table |
| Product SEO | `ProductSeo` | Add table |
| Product media | `ProductMedia` | Existing aggregate extension / baseline table creation |
| Import batch / record | `ProductImportBatch` / `ProductImportRow` | Add tables |
| Import change journal | `ProductImportChange` | Add table |
| Workflow event | `ProductWorkflowEvent` | Add table |

`CategorySpecificationGroup` and `CategoryAttribute` are also required join
tables for the specification engine.

## Classification

| Change | Classification | Reason and condition |
| --- | --- | --- |
| `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX`, `ADD CONSTRAINT` in this bundle | SAFE | Only when the target is a new, empty, project-owned test/CI database. |
| `CatalogProductStatus.REVIEW` for a pre-existing database | WARNING | PostgreSQL enum changes require a separate lock/compatibility review. |
| New indexes and foreign keys on existing tables | WARNING | They can lock or fail in the presence of orphaned or duplicate legacy data. |
| Nullable/default-backed category/product/variant additions | WARNING | Requires an ownership and drift review before use on an existing database. |
| Existing `ProductMedia` table adoption | BLOCKED | Required `id` uses client-side `cuid()` and `updatedAt` is required; no safe automatic backfill is present. |
| Unknown, shared, production, or nonempty target | BLOCKED | There is no migration baseline/history or authorization to adopt it. |

## Relation and data-integrity review

- The category self-relation does not enforce cycle prevention at database
  level; service validation remains mandatory.
- `ProductSpecification` and `ProductMedia` relation consistency with a
  product's variants is application-enforced and covered by integration tests.
- `CatalogProduct.brand` / `brandId` and `CatalogVariant.warranty` /
  `warrantyId` are compatibility fields; application writes must keep them in
  sync.
- Normal product removal must remain a soft delete. SKU and cart/inventory
  relations may legitimately block physical deletion.
- The current schema has no database `CHECK` constraints for non-negative
  stock or price. Zod and service rules remain the active guardrails.
- `ProductImportBatch` has an add-only apply-attempt token and start timestamp.
  They make an interrupted apply lease recoverable without allowing a second
  worker to finalize another worker's batch.

## Required preflight before any database action

1. `NODE_ENV` must be `test`.
2. `APPLE333_PIM_TEST_DB=1` must be explicitly set.
3. The target URL must use the dedicated test identity, literal `127.0.0.1`,
   dedicated port `55432`, `schema=public`, and an `apple333_pim_test` database
   name.
4. Read-only identity and public-schema-object checks must prove the current
   database, user, and schema match a pristine intended isolated target.
5. Migration SQL must be re-scanned for `DROP`, `TRUNCATE`, `DELETE`, or a
   destructive `ALTER` before `migrate deploy`.

No `db push`, `migrate reset`, `DROP TABLE`, `TRUNCATE`, or production URL is
permitted in this phase.
