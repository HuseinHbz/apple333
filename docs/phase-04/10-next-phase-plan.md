# Phase 04 - Next-Phase Plan

## Status

This is a sequencing plan, not authorization to start a subsequent phase. Phase
04 PIM remains incomplete until the definition of done and 9.8/10 evidence
requirements in [09-phase-completion-report.md](09-phase-completion-report.md)
are met.

No migration is applied or planned for automatic execution from this document.

## Resolve the roadmap naming conflict first

The business roadmap calls its installment module “Phase 4”, while the supplied
enterprise PIM brief calls itself “Phase 04”. Before scheduling any “Phase 05”,
the product owner must choose one of these governance options:

| Option | Result |
| --- | --- |
| Assign PIM a release key such as `PIM-01` | Preserve the original business roadmap numbering (installments remains Phase 4). |
| Formally renumber the roadmap | Publish an updated, approved roadmap mapping all prior and future phases. |
| Treat PIM as a parallel workstream | Define dependencies, owners, release criteria, and integration milestones independently. |

Until that decision is recorded, documents should use **Phase 04 PIM / Apple
Product Platform** rather than an ambiguous bare “Phase 4”.

## Immediate implementation sequence for PIM

### Gate A - migration and data safety

1. Capture schema baseline and environment/backup evidence.
2. Generate an additive migration only on a disposable PostgreSQL database.
3. Review generated SQL for enum locks, index-build impact, FK behavior,
   soft-delete semantics, and rollback/compensation feasibility.
4. Produce a migration report with data backfill batches, validation queries,
   stop conditions, and recovery steps.
5. Do not apply to shared/staging/production databases without explicit
   approval.

### Gate B - domain implementation

1. Build repository/service boundaries around existing `CatalogCategory`,
   `CatalogProduct`, `CatalogVariant`, `ProductMedia`, and `MediaFile`.
2. Implement brand, category, warranty, attributes/specifications, SKU,
   lifecycle, SEO, and audit services with strict Zod contracts.
3. Keep public/storefront DTOs compatible through explicit dual-read fallback
   mapping.
4. Implement import staging and preview before any apply/rollback endpoint.

### Gate C - administrative experience

1. Add permission-gated `/admin/products`, product detail/edit, categories,
   brands, specifications, warranties, and import pages.
2. Use server pagination/filtering and accessible error/status feedback.
3. Make product approval explicit and separate from ordinary edit actions.
4. Reuse the existing media management boundary; do not create a parallel
   upload/store system.

### Gate D - public and SEO integration

1. Implement safe public PIM projections and contract tests.
2. Integrate metadata, canonical, JSON-LD, sitemap, and cache invalidation
   only for published/indexable records.
3. Run storefront visual and API regression tests with representative published
   products and archived/draft counterexamples.

### Gate E - verification and release readiness

1. Run Prisma validation/generation, typecheck, lint, build, unit,
   integration, Playwright E2E, security, and performance checks.
2. Record actual commands, environments, results, failures, and remediation in
   [08-testing-report.md](08-testing-report.md).
3. Perform a migration dry run and limited staging pilot.
4. Obtain architecture, security, QA, and product approvals before opening a
   pull request to the agreed target branch.

## Candidate downstream dependencies

Once PIM is accepted, it is an enabling dependency for these separate scopes:

- installment catalog eligibility and product-document rules;
- trade-in model identification and condition/price rules;
- global/market price synchronization by normalized SKU/model number;
- comparison, search-index projection, recommendation, and analytics;
- multi-branch inventory enrichment and order allocation;
- knowledge-base product references and product SEO operations.

They must consume published, governed PIM contracts rather than query internal
tables or import data directly.

## Explicit non-sequencing rule

The next phase must not start merely because documentation exists. It requires
an approved roadmap label, accepted Phase 04 PIM evidence, and separate scope
authorization. In particular, no order, payment, installment, inventory
reservation, search-engine cluster, AI, or crawler work is included in this PIM
plan.
