# Phase 05 — Premium Storefront Audit

**Status:** Baseline audit only — implementation has not been declared complete.
**Date:** 2026-07-20
**Scope:** Public Apple commerce storefront, using the existing Phase 04 PIM public projection.
**Out of scope:** Checkout payment, order creation, inventory mutation, installment workflows, trade-in, CRM, accounting, ERP, database migrations, production access, and deployment.

## 1. Executive summary

The repository already contains a working public storefront foundation. It is an App Router application with reusable store components, a PIM-backed public API, a guest cart, and a quote-only checkout page. The appropriate Phase 05 approach is an incremental migration: preserve the approved UI, repair the category-response boundary, introduce a feature-first storefront façade, then add server composition, discovery, SEO, accessibility, and test coverage around the existing PIM contracts.

No product data should be invented for this phase. All product, category, availability, media, price, and comparison views must consume the existing public PIM projection.

## 2. Current architecture

| Area | Current implementation | Assessment |
| --- | --- | --- |
| Routing | Next.js App Router under `src/app/(store)` | Good foundation; pages are mostly thin wrappers around client components. |
| Store shell | `storefront-shell`, `storefront-header`, `storefront-footer` | Reusable and should be retained. |
| Data transport | `/api/store/*` routes with a standard public response envelope | Canonical browser-facing boundary; reuse it rather than introducing a parallel product API. |
| PIM source | `catalog-service` and `catalog-repository` project only published, public catalog records | Correct source of truth for Phase 05. |
| Client state | React Query for catalog/product data; Zustand for guest cart state | Suitable for interactive islands, but primary content currently lacks an SSR/ISR composition layer. |
| Cart | Guest-cart API and UI are already present | Preserve as-is; do not extend it into payment or order creation in this phase. |
| Checkout | Quote-only flow | Preserve and document as intentionally non-transactional. |
| Tests | Unit, integration, and E2E foundations exist | Coverage must expand before Phase 05 can be accepted as complete. |

### Store routes currently present

| Public route | Current component / behavior |
| --- | --- |
| `/` | `StoreHome` home experience |
| `/products` | `CatalogBrowser` catalog experience |
| `/catalog` | Legacy catalog alias using `CatalogBrowser` |
| `/products/[slug]` | `ProductDetail` PIM-backed product detail |
| `/compare` | `CompareWorkbench` for two to four products |
| `/cart` | Guest cart |
| `/checkout` | Quote-only checkout; no payment or order creation |

## 3. Canonical public PIM contracts

The following routes are the public storefront API surface to preserve and consume:

| Endpoint | Purpose | Important behavior |
| --- | --- | --- |
| `GET /api/store/categories` | Published public categories | Standard response envelope; the `data` payload is `{ items: PublicCategoryDto[] }`. |
| `GET /api/store/products` | Public paginated catalog | Supports `page`, `pageSize`, `query`, `category`, `color`, `storage`, price bounds, `inStock`, collection, and sort query parameters. |
| `GET /api/store/products/[slug]` | Product detail | Returns only the public product projection, including permitted media, variants, availability, specifications, and SEO fields. |
| `GET /api/store/products/compare?slugs=...` | Compare two to four product slugs | The caller must handle missing/invalid products and fewer than two resolved products. |
| `GET /api/store/media/[productId]/[mediaId]` | Public product media | Use the returned/authorized media URLs only. |

Compatibility aliases exist for selected legacy endpoints such as `/api/products` and `/api/categories`; they are not a reason to create additional storefront data models. New browser-facing work should prefer `/api/store/*`.

### Public response and validation conventions

Public routes use the shared store route wrapper and expose a success/data/meta response envelope. Query inputs are Zod-validated, public reads are rate-limited, and catalog responses have shared-cache directives. This is a strong base for a storefront that does not leak administrative PIM fields.

## 4. Reusable implementation inventory

The following approved UI and infrastructure should be reused instead of rewritten:

### Layout and presentation

- `src/components/store/storefront-shell.tsx`
- `src/components/store/storefront-header.tsx`
- `src/components/store/storefront-footer.tsx`
- `src/components/store/store-home.tsx`
- `src/components/store/catalog-browser.tsx`
- `src/components/store/product-detail.tsx`
- `src/components/store/product-gallery.tsx`
- `src/components/store/product-grid.tsx`
- `src/components/store/store-product-card.tsx`
- `src/components/store/compare-workbench.tsx`
- `src/components/store/cart-page.tsx`
- `src/components/store/checkout-page.tsx`
- Existing loading, empty, and error state components and shared UI primitives.

### Domain and data infrastructure

- `src/lib/store-api.ts` for typed client-side public API calls.
- `src/modules/catalog/types.ts` for the public catalog DTOs.
- `src/modules/catalog/validators.ts` for catalog and comparison query validation.
- `src/server/services/catalog-service.ts` for the public PIM projection.
- `src/server/repositories/catalog-repository.ts` for public-catalog filtering.
- `src/server/storefront/route.ts` for public route guards, validation, caching, and response formatting.
- `src/modules/cart/store.ts` and the `/api/store/cart/*` routes for the guest-cart foundation.

## 5. Verified gaps and technical debt

### Correctness

1. **Category response mismatch (priority: high).** `GET /api/store/categories` supplies `data.items`, but `StoreHome` and `CatalogBrowser` currently type the response as a category array and call `.map()` on the wrong level. A successful category response can therefore fail at runtime. The Phase 05 change must introduce a category-page DTO at the caller boundary and use `data.items`.
2. **Price-sort semantics (priority: medium).** The catalog service applies price sorting after database pagination. For a globally correct price order, sorting must occur before paging in a future approved PIM improvement. Phase 05 must document this limitation rather than conceal it in the UI.
3. **Comparison resolution (priority: medium).** The compare endpoint can omit unavailable/missing slugs. The UI needs an explicit state when fewer than two products resolve.

### Architecture and performance

1. Primary home, catalog, and product content is currently loaded in client-side React Query components. This limits first-render SEO and does not provide an intentional ISR/SSR strategy.
2. No `src/features/storefront` feature boundary exists. Storefront code is spread between route files, generic components, modules, and API helpers.
3. Product imagery currently uses unoptimized image behavior in important card/gallery paths. An approved image-host policy, responsive sizes, priority rules, and image optimization strategy are still needed.
4. No documented premium font-loading, bundle-budget, or Core Web Vitals strategy exists.
5. Catalog filtering UI exposes only a subset of the PIM query contract. There is no complete filter drawer, URL-state model, pagination control, or facet system.

### Discovery and content

1. Search is a basic database `contains` search across available text fields. It does not yet provide Persian normalization, spelling tolerance, synonyms, an indexed search backend, or a documented ranking policy.
2. Product-card and detail recommendations are category-based rather than a dedicated recommendation service.
3. The compare picker starts from a limited catalog page rather than a purpose-built search/filter experience.
4. No wishlist exists. Phase 05 can safely introduce a guest-local wishlist and a future account-sync interface without altering the database.

### SEO

1. Root metadata is generic.
2. Product-level `generateMetadata`, canonical handling, Open Graph/Twitter metadata, and Product/Breadcrumb JSON-LD are absent.
3. The sitemap currently covers only the root route; it does not enumerate published product/category URLs.
4. There is no legitimate product-review source in the public PIM projection. Review schema must not be fabricated. Its absence is an explicit Phase 05 limitation until a validated review source exists.

### Accessibility and UX

1. Existing components use several semantic controls, but there is no documented skip link, keyboard focus plan, focus restoration, modal/drawer focus trap, or screen-reader test suite.
2. Mobile navigation, account access, wishlist access, and a robust search entry point are incomplete.
3. Loading/error/empty states exist in places but are not consistently audited for keyboard and screen-reader behavior.

### Quality and operations

1. Existing tests do not yet demonstrate the requested Phase 05 coverage target for UX, catalog URL state, search normalization, wishlist behavior, SEO, and accessibility.
2. There is no current evidence of the Phase 05 Lighthouse target. It must be measured in a stable local test environment after implementation.
3. No production database or deployment action is authorized for this phase.

## 6. Recommended migration sequence

1. Create the feature-first façade under `src/features/storefront` without deleting approved UI components.
2. Fix the category DTO mismatch and add a regression test before expanding home/catalog behavior.
3. Add server composition around the existing public PIM service/projection and use a short, documented ISR interval. Interactive filtering and cart behavior remain client islands.
4. Move catalog filter/search state into canonical URL query parameters and preserve the current `/products?category=` route.
5. Add product metadata and truthful JSON-LD, then extend sitemap/robots from public catalog records only.
6. Add Persian query normalization and a swappable search adapter. Do not claim typo tolerance or a search index until an approved indexed backend exists.
7. Add a local, versioned guest wishlist plus a future account-sync interface. Do not add a database table or mutate customer data in Phase 05.
8. Improve the product gallery, product-card image policy, mobile navigation, focus behavior, empty/error states, and visible trust/availability information.
9. Add unit, integration, and E2E coverage; run typecheck, lint, build, unit, integration, and E2E checks; record measured results rather than estimates.

## 7. Route-design constraint

The requested conceptual routes `/products/[category]` and `/products/[slug]` cannot coexist as sibling dynamic routes in a Next.js App Router segment: both resolve to the same pathname shape. The current product detail route owns `/products/[slug]`.

The safe Phase 05 decision is:

- retain `/products/[slug]` for product details;
- retain `/products?category=<category-slug>` for catalog filtering and shareable category discovery;
- use a distinct namespace such as `/categories/[category]` only if a canonical category landing page is later approved.

This avoids a breaking URL migration and route ambiguity.

## 8. Risk assessment

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Rewriting the existing storefront | Loss of approved UI and regressions | Introduce feature containers/adapters first; retain existing components. |
| Treating PIM data as mock data | Incorrect pricing/availability or duplicated domain logic | Consume only the public PIM contracts and projections. |
| Adding a category dynamic segment under `/products` | Build-time App Router route conflict | Use query-state filtering or a separate `/categories` namespace. |
| Shipping untruthful review/rating schema | SEO policy and trust issue | Omit Review JSON-LD until a validated review source is available. |
| Implementing “smart search” only in the UI | Misleading performance/quality claim | Document an interim adapter; plan a separately approved indexed search capability. |
| Guest wishlist mistaken for account data | Privacy/data-loss expectation mismatch | Label it as device-local; define future authenticated sync separately. |
| Changing PIM schema or public filters incidentally | Phase 04 regression or migration risk | No schema changes in this phase; make new PIM work a separately reviewed task. |
| Unmeasured performance claims | Production-quality risk | Report Lighthouse/Core Web Vitals only from reproducible measurements. |

## 9. Acceptance boundary for this audit

This document records the pre-implementation baseline and the migration guardrails. It does **not** certify Phase 05 as complete. Completion requires implemented code, passing quality gates, documented test results, and an explicit final engineering report.
