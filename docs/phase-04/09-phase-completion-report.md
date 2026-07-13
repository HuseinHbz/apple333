# Phase 04 — Apple Product Platform Completion Report

## Current conclusion

The Phase 04 PIM application layer is implemented on
`feature/phase-04-product-platform`, but the phase is **not deployable to a
shared environment yet**. The intentionally missing gate is a reviewed,
additive Prisma migration and an isolated PostgreSQL verification run.

No migration, database push, seed, reset, truncate, backfill, or production
database operation was run while implementing this phase.

## Implemented application scope

- Additive PIM schema design extending the Phase 03 `Catalog*` aggregate:
  brand, warranty, normalized SKU, specification groups/attributes/values,
  structured specifications, product SEO, workflow events, and staged import
  records.
- Strict Zod contracts, domain services, explicit Prisma projections,
  optimistic product/variant version checks, workflow events, audit entries,
  soft archive behavior, media-kind checks, and category-cycle checks.
- RBAC permissions for products, taxonomy, attributes, warranties, and imports,
  plus `CATALOG_MANAGER` and `CATALOG_APPROVER` seed definitions.
- Protected administrative routes for product lifecycle, variants, media,
  specifications, brands, categories, warranties, specification definitions,
  staged imports, and import apply.
- Administrative screens for the product list/editor, brand/category/warranty
  managers, specifications, and CSV import staging.
- Public compatibility aliases at `/api/products`, `/api/products/[slug]`, and
  `/api/categories`, backed by the existing safe Phase 03 public projection.
- A bounded CSV parser that treats formulas as text; a CSV batch is validated
  before it can be applied.

## Explicit limitations / release blockers

1. **Schema migration is deliberately not created or applied.** The new Prisma
   models cannot be used against a pre-Phase-04 database until the migration
   report is reviewed and an additive migration is generated on a disposable
   PostgreSQL database.
2. The client provides direct CSV staging. The API supports the `XLSX` source
   format contract, but an XLSX binary-to-row adapter is not added because the
   repository has no approved workbook parser dependency or storage-reader
   integration.
3. Database-backed service behavior, migration compatibility, import apply,
   and workflow persistence require an isolated PostgreSQL environment after
   migration approval. The automated integration tests currently verify route,
   permission, validation, cache, and error-boundary behavior with service
   mocks; they do not claim database persistence evidence.
4. Import apply is protected by batch state and a change journal. Reversible
   rollback is intentionally not exposed until a concurrency-safe compensation
   policy is reviewed.

## Quality evidence available in this workspace

| Gate | Result | Notes |
| --- | --- | --- |
| Prisma schema validation | Pass | Executed with an inert local validation URL; no connection or database change. |
| TypeScript strict typecheck | Pass | `tsc --noEmit`. |
| ESLint | Pass | `eslint .`. |
| Production build | Pass | `next build`; all Phase 04 pages and routes compiled. |
| PIM unit tests | Pass | Validators and CSV parser. |
| PIM route integration tests | Pass | Validation, RBAC, same-origin enforcement, audit context, and public aliases. |
| Full database integration | Blocked | Requires approved additive migration plus isolated PostgreSQL. |
| Browser E2E | Pass | 7 Playwright smoke/regression tests passed against a local production build. |

## Definition of done status

| Requirement | Status |
| --- | --- |
| Single PIM domain extends Phase 03 aggregates | Implemented in Prisma schema; migration pending |
| Brand/category/warranty/specification administration | Implemented in application layer |
| Draft → review → publish → archive workflow | Implemented in application layer |
| Variant and normalized SKU handling | Implemented in application layer |
| Media association and public compatibility boundary | Implemented in application layer |
| Staged CSV import | Implemented; database migration pending |
| Direct XLSX parsing | Deferred pending approved parser/storage integration |
| Public aliases and storefront compatibility | Implemented and route-tested |
| Shared-environment release | Blocked by migration and database evidence |

## Phase numbering note

Historical roadmap material also uses “Phase 4” for installments. This report
uses **Phase 04 PIM / Apple Product Platform** for the supplied enterprise
brief; it does not claim installment work is complete or authorize Phase 05.
