# Phase 05.1 — Module 01: Current-State Audit

**Status:** Baseline audit complete; Phase 05.1 is **not approved**.
**Date:** 2026-07-20
**Audited branch:** `feature/phase-05.1-storefront-production-validation`
**Audited revision:** `4003309 chore(deploy): harden phase 04.1 release safeguards`
**Scope:** The Phase 05 public storefront working tree and its existing evidence.
**Excluded:** Application changes, deployment, production access, database access, migrations, seeds, and business modules outside the storefront.

## 1. Executive decision

Phase 05 has a sound implementation foundation: it preserves the existing
store UI, consumes the public PIM projection, uses strict TypeScript and Zod
validation, and adds server composition, SEO, a guest wishlist, and focused
tests. It is not yet production-acceptance evidence.

The missing evidence is specific and actionable: an isolated staging stack,
storefront-scale measurements, reproducible Lighthouse and accessibility
results, a complete seeded E2E run, and an explicit dependency-risk decision.
No score of `>= 9.8/10` should be claimed until those gates are satisfied.

This audit is read-only. It did not run a database command, write application
code, access a production system, or reproduce prior test results. Existing
test and benchmark figures below are cited as prior evidence, not newly
measured results.

## 2. Repository and evidence boundary

The audited branch is not `main`, as required. The working tree contains a
large set of pre-existing modified and untracked files spanning deployment,
Phase 02 documentation, Phase 05 storefront work, and prompt tooling. This
audit adds only this document. It must not be used to imply that the entire
working tree is a single atomic Phase 05.1 change.

Before any implementation module starts, preserve unrelated changes and
separate Phase 05.1 changes into small, reviewable commits. No reset, cleanup,
or deletion is authorized by this audit.

### Existing evidence, as reported by Phase 05 and Phase 04.1

| Area | Existing evidence | What it proves | What it does not prove |
| --- | --- | --- | --- |
| Static quality | Phase 05 reports passing `pnpm typecheck`, `pnpm lint`, and `pnpm build`. | The audited storefront source compiled and built at that point. | Current working-tree, staging, and production behavior. |
| Automated tests | Phase 05 reports 98 unit tests, 27 integration tests, 125 Vitest tests total, and 11 scoped storefront Playwright tests. | Basic contracts and route-shell behavior. | Seeded product journeys, full CI E2E, or accessibility conformance. |
| PIM scale | Phase 04.1 records an isolated PostgreSQL 16.6 benchmark at 10k and 100k products. At 100k it reported public-listing HTTP p95 `117.225ms` and listing SQL p95 `59.887ms`. | The prior PIM listing/detail harness has real isolated-database evidence. | Storefront rendering, search/sort/filter combinations, images/CDN, cache warm/cold behavior, or a Phase 05.1 staging stack. |
| Security | Phase 05 reports no High/Critical production dependency advisory and two Moderate transitive advisories. | A prior dependency review occurred. | A current resolution/acceptance decision, staging headers, or runtime security validation. |

## 3. Existing storefront architecture

### 3.1 Route and rendering model

| Layer | Current implementation | Assessment |
| --- | --- | --- |
| App routes | `src/app/(store)` owns home, `/products`, legacy `/catalog`, product detail, category discovery, comparison, cart, checkout, and wishlist routes. `/account` is a separate account-foundation route. | App Router is used correctly. Product and category URLs avoid the known dynamic-route collision by using `/categories/[category]`, not `/products/[category]`. |
| Server composition | `src/features/storefront/containers/*` composes home, catalog, detail, and comparison snapshots on the server. | A good incremental transition from client-only data loading; preserves existing UI components. |
| Interactive UI | Approved components remain under `src/components/store/*`; React Query powers interactive catalog, cart, comparison, and header islands. | Reusable UI has been preserved, but the boundary is split across legacy components and the new feature facade. |
| Feature facade | `src/features/storefront/{components,containers,hooks,queries,schemas,services,types}` holds new storefront orchestration. | The requested feature-first boundary now exists, but not all storefront behavior has moved behind it. |
| Rendering/cache | Route pages expose `revalidate = 60`; `server-catalog.ts` uses `unstable_cache` with a 60-second TTL. | Suitable provisional ISR-style caching; invalidation behavior must be demonstrated. |

### 3.2 Data and state flow

```text
Published PIM records
        |
        +--> catalog-service / catalog-repository
        |         |
        |         +--> server storefront containers + unstable_cache (60s)
        |
        +--> /api/store/* (Zod validation, public response envelope,
                            rate limit and cache policy)
                  |
                  +--> React Query client islands

Guest cart: opaque cookie + existing cart store/API
Guest wishlist: browser localStorage only (no customer persistence)
```

The two public data paths intentionally share the same PIM service/projection;
there is no duplicate product model. Browser code uses the canonical
`/api/store/*` contract, while server containers call the public PIM service
directly to avoid an internal loopback request.

### 3.3 Public PIM contract used by the storefront

- Published categories: `GET /api/store/categories`, with `{ data: { items } }`.
- Catalog: `GET /api/store/products`, with validated page, query, brand, model,
  category, color, storage, price, stock, collection, and sort inputs.
- Detail and comparison: `GET /api/store/products/[slug]` and
  `GET /api/store/products/compare`.
- Cart and quote-only checkout: existing guest-cart routes are retained.

The PIM repository applies public visibility and sellable-variant predicates
before returning public DTOs. Storefront code does not query Prisma directly.
Public API routes use shared cache headers for reads, private/no-store for
mutations, request rate limits, and same-origin protection for cart mutations.

### 3.4 SEO, discoverability, and media

- Root and product metadata live in `src/features/storefront/services/metadata.ts`.
- Product and breadcrumb JSON-LD uses typed PIM data and escapes `<` before
  insertion. No fabricated review schema is emitted.
- `robots.ts` excludes private/publicly non-indexable areas such as account,
  cart, checkout, wishlist, admin, and API routes.
- `sitemap.ts` uses a compact PIM projection, excludes `noIndex` products, and
  has twenty 50k-URL shards (one million URL capacity).
- Product cards and the gallery use `next/image` with explicit responsive
  `sizes`; the cart still uses `unoptimized` image rendering.

### 3.5 Search, comparison, and account state

- Query-side Persian/Arabic normalization and a bounded synonym-expansion
  adapter exist in `features/storefront`.
- The catalog URL builder normalizes the primary query and keeps filter state
  shareable in the URL.
- Guest wishlist state is Zod-validated local storage with canonical slugs,
  a 100-item bound, hydration handling, and cross-tab updates. Its
  authenticated sync port is deliberately design-only.
- Comparison accepts two to four products through the PIM contract.
- There is no customer-authenticated storefront account, payment, order,
  inventory, installment, trade-in, CRM, accounting, or ERP implementation in
  scope; this is intentional and must remain so in Phase 05.1.

## 4. Existing limitations and technical debt

The following items are evidence-backed observations from the current source
and Phase 05 records. Severity is based on production-validation impact, not
on a claim of a live incident.

| Priority | Finding | Evidence / impact | Recommended disposition |
| --- | --- | --- | --- |
| P0 | No isolated Phase 05.1 staging evidence | No dedicated `apple333-staging` stack, non-production object store, or current storefront run evidence is recorded. | Create the isolated environment before measurements; never point it to production credentials or data. |
| P0 | Full E2E gate is not green on this Windows workspace | `pnpm test:e2e` was blocked before test execution by standalone-runtime filesystem-link preparation; unscoped local E2E also lacked the required database configuration. | Reproduce in Linux CI/staging with an isolated PostgreSQL/Redis target and retain artifacts. |
| P0 | No Lighthouse or field-like storefront measurements | Phase 05 reports build asset sizes but explicitly does not claim Lighthouse, CWV, image/CDN, or browser performance scores. | Establish repeatable desktop/mobile Lighthouse and trace collection after staging exists. |
| P0 | Phase 05.1 acceptance data is incomplete | Prior PIM 10k/100k evidence is real, but it does not cover storefront search, sort/filter permutations, rendering, images, cache behavior, or the required controlled Apple-like dataset. | Extend/reuse the guarded PIM harness rather than inventing a parallel unsafe benchmark. |
| P1 | Global price ordering is not correct | `catalog-service.ts` maps a database page and then applies card-level price sorting. Price order can therefore be correct only within a page. | Move price order into the approved repository query before pagination; benchmark and regression-test it. This may require a reviewed schema/index plan, not an ad hoc migration. |
| P1 | Search adapter is not connected to the catalog UI | `createPublicPimCatalogSearchAdapter` is referenced by unit tests, while the catalog UI uses the primary normalized URL path. The richer synonym expansion is not evidenced as a user-facing catalog behavior. | Decide whether to integrate it with transparent “approximate” semantics or defer it; do not represent it as production search quality yet. |
| P1 | Search is not index-backed or globally ranked | Current PIM searching is based on case-insensitive matching; there is no PostgreSQL FTS/trigram index, typo ranking, merchant synonym configuration, or OpenSearch implementation. | Measure real query plans first; then choose PostgreSQL FTS/`pg_trgm` or a future OpenSearch adapter through a migration report. |
| P1 | Cache invalidation is unproven | Storefront cache tags exist, but no storefront-scope `revalidateTag`/`revalidatePath` invocation was found in the audit. Published PIM changes can remain stale for the TTL unless invalidation is added elsewhere. | Trace PIM publish/unpublish to cache invalidation; add targeted invalidation only after the contract is designed and tested. |
| P1 | Server data failures are deliberately swallowed | Home and catalog containers use a broad `catch` and render client/error-state fallbacks. This protects route availability but does not distinguish a transient PIM outage, validation fault, or programming error, and does not show storefront-specific telemetry. | Add classified, privacy-safe logging/metrics and test expected fallback paths; avoid exposing internals to users. |
| P1 | Canonical coverage needs rendered-page verification | Product and category pages set canonical metadata, but `/products`, `/compare`, and the legacy `/catalog` route do not declare route-specific metadata in their page files while root metadata sets `/` as canonical. | Verify rendered canonical tags. Define `/catalog` as a redirect or explicit canonical to `/products`; add canonical metadata for indexable list/compare pages. |
| P1 | Image-host policy is implicit | No `images`/`remotePatterns` configuration was found in `next.config.ts`; product images use `next/image`, and metadata accepts a PIM `heroMediaUrl`. | Verify that public PIM media is a same-origin/proxied path. If external media is allowed, introduce an explicit allow-list, image CSP strategy, dimensions, cache behavior, and load tests. |
| P1 | Sitemap uses offset shards over mutable data | Dynamic sitemap shards use `skip/take` ordered by `updatedAt`; concurrent catalog changes can shift offsets between crawler fetches. Twenty shards are emitted regardless of current catalog size. | Validate runtime sitemap semantics in staging. Consider a stable cursor/snapshot strategy before very large mutable catalogs. |
| P2 | Mobile menu is only a labeled link | The mobile “menu” control links to `/products`; it does not expose a dialog/drawer or the desktop navigation choices. | Either relabel it as products or implement an accessible mobile navigation pattern with focus management. |
| P2 | Comparison affordance permits a no-op single selection | The comparison trigger is disabled only for zero selections, while comparison requires at least two. | Disable the action below two selected products and make the minimum requirement explicit. |
| P2 | A cart image path bypasses optimization | `cart-page.tsx` still sets `unoptimized` on its product image. | Remove only after confirming image source compatibility and measuring the image pipeline. |
| P2 | Client/server datastore paths require parity tests | Browser API and server direct-service paths share DTOs but have different caching/error boundaries. | Add contract tests for equivalent published data, visibility, cache headers, and error behavior. |
| P2 | Dependency decision remains open | Prior audit reports Moderate transitive paths through `postcss` and `uuid`/`next-auth`; no High/Critical finding was reported. | Upgrade safely or record an explicit, time-bounded risk acceptance in Module 11. |

## 5. Validation gaps against Phase 05.1

| Phase 05.1 gate | Current state | Required evidence to close it |
| --- | --- | --- |
| Isolated staging | Missing | Reproducible application, PostgreSQL, Redis, object-storage configuration; separate credentials; deployment and rollback runbook. |
| 10k/100k controlled dataset | Partially available through Phase 04.1 PIM harness | Phase 05.1 fixture definition for Apple-like product/variant/category/specification shapes, repeatable run output, and explicit proof of non-production targeting. |
| Database validation | Partially available for prior PIM queries | New `EXPLAIN (ANALYZE, BUFFERS)` evidence for public filters, brand/model, text search, each sort, pagination, detail, category, and sitemap paths. |
| API p95 <250ms | Not accepted for the complete Phase 05.1 surface | Warm and cold measurements at both scales, including error rate, response size, cache state, concurrency, and percentile method. The old public-listing result is useful but insufficient. |
| Lighthouse | Missing | Versioned desktop/mobile reports for `/`, `/products`, an actual product detail, and a category page; budgets and raw artifacts. |
| Accessibility | Partial semantic implementation; no conformance evidence | axe/Playwright results, keyboard-only traversal, focus restoration, contrast review, and manual screen-reader checks documented against WCAG 2.2 criteria. |
| Search quality | Foundation only | Normalization corpus, Persian/Arabic variants, typing-error cases, ranking relevance tests, query-plan evidence, and a documented migration path to OpenSearch. |
| Full E2E | Partial shell coverage | At least ten data-backed journeys for home, catalog/filter/search, detail, comparison, wishlist, and cart on an isolated seed database; CI artifacts for failures. |
| Security | Static safeguards and prior audit exist | Runtime header/CSP review, public API abuse/rate-limit tests, data-exposure checks, and a dependency decision. |
| CI gate | Partial | A workflow execution that passes typecheck, lint, build, unit, integration, full E2E, security audit, and performance evidence on a supported host. |

## 6. Concrete optimization and validation plan

The sequence below avoids feature creep and protects the PIM as the sole
product source of truth.

### Step 1 — Establish safe measurement prerequisites (Modules 02 and 09)

1. Create an isolated `apple333-staging` configuration with separate
   application, PostgreSQL, Redis, and object-storage identities.
2. Add an explicit target-identity preflight that refuses production URLs,
   hostnames, roles, and buckets before any seed or benchmark action.
3. Repair the standalone-runtime/Playwright path on Linux CI or the staging
   host; retain Playwright report, trace, screenshot, and server log artifacts.
4. Keep this environment non-production and disposable. Do not reuse customer
   data or production object storage.

**Exit evidence:** documented configuration, masked environment-variable list,
successful health/readiness checks, and a full E2E run against the isolated
target.

### Step 2 — Reuse and extend the controlled benchmark safely (Modules 03 and 04)

1. Review `scripts/benchmark-pim-catalog.mjs` and its existing safeguards
   before creating a second seed path. It already enforces an isolated target,
   unique run ID, 10k/100k scale, retained markers, and `EXPLAIN` sampling.
2. Add only the Phase 05.1 fixture coverage that is missing: realistic
   iPhone/accessory families, variants, colors, storage, categories, brands,
   specifications, media references, and published/unpublished edge cases.
3. Run repeatable `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` measurements for
   catalog filters, all sorts, brand/model, search candidates, detail,
   category, comparison, and sitemap projection.
4. Capture p50/p95, row counts, plan nodes, index usage, buffer statistics,
   response size, cache condition, and sample count. Do not call an index
   “used” without the plan artifact.

**Decision gates:**

- Correct global price sort before page slicing.
- Select FTS/`pg_trgm` only if measured search plans justify it.
- Produce a migration report before any schema, extension, or index change;
  do not apply a destructive migration.

### Step 3 — Optimize the storefront from measured bottlenecks (Module 05)

1. Measure the baseline on the isolated target before changing bundle, cache,
   image, or rendering behavior.
2. Make PIM publish/unpublish cache invalidation explicit and test tag/path
   behavior, with the 60-second TTL as a safe fallback.
3. Classify server-container failures and emit operationally useful metrics
   without exposing catalog internals to clients.
4. Validate media origin and introduce a narrow allow-list/proxy policy before
   changing image optimization. Then remove the cart `unoptimized` path only
   if the result is safe and measured.
5. Set page-level bundle and Web Vitals budgets. Use dynamic imports only when
   measurement proves a meaningful route-level improvement.

**Exit evidence:** before/after measurements, changed budget values, cache
behavior tests, and no regression in server-rendered PIM data.

### Step 4 — Close SEO and accessibility correctness gaps (Modules 06 and 07)

1. Test the rendered canonical, robots, metadata, Open Graph, and JSON-LD of
   home, catalog, legacy catalog alias, category, and product detail pages.
2. Resolve the `/catalog` duplication decision by redirect or canonicalization;
   do not leave it implicit.
3. Verify sitemap behavior against current product count and an intentionally
   changing benchmark catalog; document whether offset shards are acceptable.
4. Run desktop/mobile Lighthouse on representative seeded pages and save raw
   reports under `docs/phase-05.1/lighthouse/`.
5. Add axe/Playwright assertions and manual keyboard/screen-reader evidence.
   Correct mobile navigation semantics, comparison action state, focus order,
   dialogs/drawers, errors, and live regions before claiming WCAG confidence.

### Step 5 — Finish search, security, and dependency decisions (Modules 08, 10, and 11)

1. Define a test corpus for Persian/Arabic character normalization, digits,
   whitespace, transliteration, common mistakes, and model/storage tokens.
2. Decide whether the bounded synonym adapter is a temporary UI feature or a
   backend concern. Its current approximate pagination must remain visible in
   its contract.
3. Record a PostgreSQL-to-OpenSearch migration path that preserves public DTOs
   and does not create a duplicate product model.
4. Re-run the dependency audit in the isolated build, identify the current
   transitive chains, and either upgrade with regression evidence or approve a
   named, time-bounded risk acceptance.
5. Test public API validation/rate limits, same-origin mutation protection,
   data exposure, and staging security headers. Treat High/Critical advisories
   as release blockers.

### Step 6 — Finalize only from reproducible evidence (Module 12)

Run the complete quality gate on a supported host:

```text
typecheck -> lint -> build -> unit -> integration -> seeded E2E
-> security audit -> database/API benchmark -> Lighthouse -> accessibility audit
```

Attach raw reports, not screenshots of summaries. Phase 05.1 remains
unapproved if any required artifact is absent, any suite fails, any data target
is not demonstrably isolated, or the final evidence-backed score is below
`9.8/10`.

## 7. Recommended Module 01 handoff

1. Start Module 02 (staging design) without using production credentials.
2. Reuse the Phase 04.1 guarded benchmark architecture as the starting point
   for Modules 03 and 04; do not duplicate its safety checks.
3. Prioritize CI/E2E repair and current-page canonical verification before
   performance tuning, because both can invalidate later measurements.
4. Do not introduce inventory, orders, payment, installments, trade-in, CRM,
   accounting, ERP, or a duplicate PIM model during this validation phase.

## 8. Approval status

**Phase 05.1 is not approved.** The current source is a credible baseline for
production validation, but it does not yet contain the required staging,
measurement, Lighthouse, accessibility, full E2E, and dependency-decision
evidence.
