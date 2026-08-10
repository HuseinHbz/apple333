# Phase 05.1 — Database Performance Report

**Status:** Evidence baseline only; Phase 05.1 database performance is **not approved**.
**Date:** 2026-07-20
**Scope:** Source and prior-artifact review only. No database connection, seed, migration, EXPLAIN, benchmark, or production operation was performed for this report.

## 1. Decision

The project has valuable prior database performance evidence from Phase 04.1, but it is not a Phase 05.1 storefront validation. It is a baseline to reuse safely, not current acceptance evidence.

The current Phase 05.1 working tree also contains a deterministic storefront fixture generator, but it has not been executed. There are no current EXPLAIN (ANALYZE, BUFFERS) artifacts, query timings, or p95 measurements for the Phase 05.1 catalog surface.

## 2. Prior Phase 04.1 PIM baseline

The approved Phase 04.1 report records a guarded run on GitHub-hosted ubuntu-latest, PostgreSQL 16.6, and isolated apple333_pim_test. It identifies source commit b82bef573928393ab79354102b6d196cdd33c280, workflow run 29238326931, job 86778151181, and a retained evidence artifact. It explicitly states that no shared, development, or production database was used.

### Prior thresholds and method

| Prior Phase 04.1 gate | Threshold | Recorded result |
| --- | ---: | --- |
| Public HTTP endpoint p95 | <= 3,000ms | Pass at 10k and 100k products |
| SQL EXPLAIN execution p95 per measured path | <= 250ms | Pass at 10k and 100k products |
| HTTP response status | 200 for each of five samples per path | Pass at both scales |

The prior harness refreshed planner statistics, executed plan measurements serially, and captured planning/execution time, rows, root plan node, shared-buffer counts, and index names. Those evidence practices must be retained.

### Prior recorded metrics

| Scale | SQL p95: listing / category listing / detail | SQL p95: SKU / workflow | HTTP p95: listing / category listing / detail / categories |
| --- | --- | --- | --- |
| 10,000 products | 16.271 / 15.727 / 0.156ms | 0.055 / 0.050ms | 94.875 / 26.302 / 18.161 / 4.729ms |
| 100,000 products | 59.887 / 47.034 / 0.138ms | 0.068 / 0.066ms | 117.225 / 105.905 / 12.979 / 4.392ms |

At 100k, the recorded listing/category-listing plan named CatalogVariant_productId_optionKey_idx and ProductSku_variantId_key; the detail plan named CatalogProduct_slug_key plus variant/SKU indexes. The report also records that broad 10k listing paths chose sequential access because the fixture was deliberately non-selective, not because an index claim was being made.

## 3. Why this is not a Phase 05.1 pass

1. The prior HTTP harness exercised legacy /api/products and /api/categories paths, not the full browser-facing /api/store route behavior, cache headers, rate limiting, and storefront render path.
2. It measured newest listing, category-filtered listing, detail, and categories. It did not measure brand/model, color, storage, price, stock, collection, free text, comparison, sitemap, or all sort combinations.
3. Its fixture is a PIM benchmark fixture. Phase 05.1 requires controlled Apple-storefront-shaped data with categories, brands, variants, colors, storage, specifications, and media references.
4. It does not measure server-component rendering, unstable-cache behavior, CDN/image delivery, browser experience, cold cache, cache invalidation, or staging resource limits.
5. The prior HTTP threshold was 3,000ms. Phase 05.1 requires p95 API response below 250ms for its relevant surface. Encouraging individual prior values do not satisfy that broader acceptance claim.

## 4. Current query-surface review

This is a source review, not a plan result. The next isolated benchmark must measure each of these surfaces.

| Surface | Current observation | Required evidence |
| --- | --- | --- |
| Base catalog | Public visibility/sellable-variant criteria, order, offset pagination, and count are applied. | Cold/warm API and SQL p50/p95, plan, count cost, rows, buffers, response size, and pagination depth. |
| Category | Category slug is a relation predicate. | Selective and non-selective category plans at 10k and 100k. |
| Brand | Brand uses case-insensitive equality. | Plan/index evidence for realistic brand distribution. |
| Model | Product name/slug and active variant modelNumber use case-insensitive contains predicates. | Plan/index evidence, candidate count, and p95 at both scales. |
| Text search | Name, brand, summary, and slug use case-insensitive contains in an OR. | Baseline plan plus an FTS/pg_trgm decision; no scalable-search claim before evidence. |
| Variant filters | Color, storage, price, and active variant criteria are relation predicates; in-stock adds inventory/branch criteria. | Combined-filter plans and response p95, including high-cardinality and empty results. |
| Sorting | Database handles newest/name/featured. Service-level price sort occurs after database pagination. | Correct global price-order design and regression test before performance acceptance. |
| Detail/comparison | Detail selects public projections; comparison fetches published slugs. | Detail and 2–4-product comparison plans, payload sizes, and p95. |
| Sitemap | Compact public projection uses updatedAt ordering with skip/take shard windows. | Plan and duration per shard at realistic size; offset-consistency review during updates. |

## 5. Available but unexecuted tooling

| Tool | Current purpose | Evidence status |
| --- | --- | --- |
| scripts/benchmark-pim-catalog.mjs | Existing guarded Phase 04.1 10k/100k PIM/API benchmark; exact isolated test identity, explicit seed authorization, unique run ID, and loopback API target are required. | Prior Phase 04.1 run exists; no new Phase 05.1 run was performed here. |
| scripts/seed-performance-data.ts | Current working-tree deterministic Phase 05.1 generator for 10k/100k synthetic storefront-shaped fixtures, with target checks and no cleanup behavior. | Tooling only; not executed for this report. |
| tests/unit/seed-performance-data.test.ts | Tests generator scale, deterministic fixture shape, and production-like URL rejection. | Test source exists; not run by this report. |
| pnpm pim:benchmark | Existing package script that exposes the Phase 04.1 harness. | Not run by this report. |

The Phase 05.1 generator and Phase 04.1 harness must be reconciled before execution so one controlled target, fixture marker, and measured-path set is used. Do not run independent writers against one retained fixture database merely to produce a report.

## 6. Required measurement protocol

1. Provision the isolated target described in [02-staging-environment.md](02-staging-environment.md), or an equally guarded disposable PIM test target. It must not be a production, staging, developer, or shared database.
2. Validate target identity before any writer opens Prisma. Use a fresh unique run ID; do not clean, truncate, reset, or reuse partial fixtures.
3. Build and serve the application on a supported host with the exact isolated target. Record source SHA, Node.js, PostgreSQL, OS, CPU/memory limits, cache state, run ID, scale, and time.
4. At 10k and 100k, collect repeated public API timings and serialized EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) results for every surface above. Separate cold from warm cache observations.
5. Record p50/p95, status/error distribution, body size, rows, plan node, planning/execution time, buffer hits/reads, and named indexes. Attach raw JSON/plans rather than a copied summary only.
6. If an index, PostgreSQL extension, schema change, or different pagination model is proposed, stop and create a migration report before any database change. No destructive migration is authorized.

## 7. Phase 05.1 measurement matrix

No value below has been measured for Phase 05.1 yet.

| Scale | Surface | SQL p50/p95 | API p50/p95 | Plan/index evidence | Result |
| --- | --- | --- | --- | --- | --- |
| 10k | Catalog/filter/search/sort/detail/compare/sitemap | Not run | Not run | Not collected | Not accepted |
| 100k | Catalog/filter/search/sort/detail/compare/sitemap | Not run | Not run | Not collected | Not accepted |

## 8. Blockers and approval rule

| Blocker | Effect |
| --- | --- |
| No provisioned isolated target with a complete Phase 05.1 fixture | No valid current query or API measurement can start. |
| Staging bootstrap is documented as blocked by the current Phase 04.1 release gate | Do not bypass deployment safeguards or use a production-like target as a shortcut. |
| No Phase 05.1 query-plan artifacts | Index and performance claims would be speculative. |
| Search/index and global price-sort design are unresolved | A benchmark cannot make current behavior correct or scalable. |

**Approval rule:** Phase 05.1 database performance remains unapproved until isolated runs, raw plan artifacts, response measurements, and reviewed optimization decisions exist. Prior Phase 04.1 figures must remain clearly labeled as prior PIM baseline evidence.
