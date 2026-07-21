# Phase 05.1 — Application Performance Report

**Status:** Source/build baseline only; Phase 05.1 application performance is **not approved**.
**Date:** 2026-07-20
**Scope:** Storefront source review plus a local production build. No staging server, database benchmark, browser benchmark, Lighthouse run, or production system was used for this report.

## 1. Decision

The storefront contains sensible performance-oriented implementation choices, and a Phase 05.1 local production build succeeds. Neither fact is a measured application-performance result. The required Phase 05.1 metrics for browser rendering, Core Web Vitals, cold/warm caches, image delivery, and real catalog volume are not available.

This report documents the baseline, risks, and measurement plan. It does not approve Phase 05.1 or assign a performance score.

## 2. Current performance-oriented architecture

| Area | Current implementation | Validation still required |
| --- | --- | --- |
| Server rendering | Home, catalog, category, product, and comparison use feature containers around the typed public PIM service. | Measure TTFB, streaming/render duration, and fallback behavior against a real isolated catalog. |
| Cache | Route pages and unstable-cache use a 60-second revalidation policy for public PIM snapshots. | Measure cold/warm behavior, hit rate, stale window, publish/unpublish invalidation, and cross-process behavior. |
| Client islands | Filters, gallery, comparison selection, cart, and wishlist remain interactive client code while primary PIM content has a server snapshot. | Measure hydration/interaction cost and avoid regressions before changing split points. |
| Public API | Browser data uses /api/store routes with public cache policy; mutation responses are private/no-store. | Verify headers and end-to-end behavior behind the staging proxy/CDN. |
| Product media | Product card/gallery use Next Image with responsive sizes; gallery prioritizes active product media. | Confirm PIM media origin, allow-list/proxy policy, transformations, formats, cache headers, and LCP behavior. |
| Cart media | Cart product image still uses unoptimized rendering. | Do not remove it blindly; first validate source compatibility and measure the optimized replacement. |
| Sitemap | Public sitemap uses a compact PIM projection and 50k URL shards instead of product-detail hydration. | Measure shard-generation time and memory with 10k/100k fixtures. |

## 3. Current local build evidence

On 2026-07-20, the final `pnpm build` completed with exit code 0 in the local workspace. Next.js 15.5.18 compiled successfully in 11.0 seconds; the command's observed wall time was 63.0 seconds and it generated 79 static pages. These values are local build telemetry, not browser or production performance measurements.

| Route family | Current First Load JS | Interpretation |
| --- | ---: | --- |
| Home (`/`) | 224 kB | Useful regression indicator only. |
| Catalog (`/products`) | 227 kB | Useful regression indicator only. |
| Product detail (`/products/[slug]`) | 229 kB | Useful regression indicator only. |
| Comparison (`/compare`) | 200 kB | Useful regression indicator only. |

First Load JS includes framework/shared assets and varies with build host, Next.js output, route changes, and dependency versions. It is not a Lighthouse score, an LCP/INP/CLS result, an HTTP latency result, or a production-capacity claim.

## 4. Evidence intentionally absent

No Phase 05.1 result currently exists for:

- desktop or mobile Lighthouse;
- LCP, INP, CLS, TTFB, total blocking time, or real-user monitoring;
- server render duration or streaming behavior;
- PIM cache hit/miss, revalidation, or invalidation latency;
- image compression, responsive source selection, CDN/origin latency, or LCP priority under a browser trace;
- 10k/100k storefront page rendering, memory, CPU, or response-size behavior;
- slow-network/mobile behavior representative of the target Persian audience;
- proxy/cache behavior on the intended staging topology; or
- an application performance before/after comparison.

The absence is expected: [02-staging-environment.md](02-staging-environment.md) documents that a live isolated staging installation is not yet evidenced and its bootstrap is blocked by the current Phase 04.1 release safeguard.

## 5. Available tooling and its limits

| Tool | What it can support | What it does not establish yet |
| --- | --- | --- |
| pnpm build | A production artifact can compile; Phase 05.1 local build passed. | Browser performance or production readiness. |
| scripts/seed-performance-data.ts | Deterministic 10k/100k synthetic product data for an isolated database. | A completed seed, server-render measurement, or browser result. |
| scripts/benchmark-pim-catalog.mjs | Prior guarded PIM/API p50/p95 and SQL-plan evidence. | Storefront rendering, client hydration, images, or browser metrics. |
| scripts/run-lighthouse.mjs | Guarded desktop/mobile Lighthouse execution for home, products, detail, and category pages. | Any score until it runs successfully against an isolated target. |
| Playwright | Data-backed route and interaction validation once a supported target exists. | Lighthouse, real-user metrics, or staging deployment. |

The current working tree includes a Lighthouse runner and dependency, but the runner is tooling, not an executed measurement. Its production-domain protection is a safety control, not evidence of performance.

## 6. Known performance risks to validate

| Risk | Current mitigation | Required next measurement or decision |
| --- | --- | --- |
| Large catalog | PIM projection, server cache, pagination, and prior Phase 04.1 baseline. | Validate full storefront/API path at 10k and 100k, including offset depth and response body size. |
| Search fan-out | Synonym candidates are bounded. | Measure user-visible search latency and fan-out. Decide indexed search only from plan evidence. |
| Global price sort | Current service sorts price cards after database pagination. | Correct behavior before measuring it as a scalable sorted catalog. |
| Cache freshness | 60-second TTL tags exist. | Establish publish/unpublish invalidation, cold/warm behavior, and cache-header evidence. |
| Product images | Next Image plus explicit sizes on card/gallery routes. | Validate host policy, transformations, LCP priority, and cart's remaining unoptimized path. |
| Sitemap scale | Compact public projection avoids full detail loads. | Measure shard window duration/memory and offset behavior during updates. |
| Client interaction | Feature-specific client islands limit global client state. | Measure hydration, interaction delay, and accessible error/loading states on mobile and desktop. |

## 7. Required Phase 05.1 measurement protocol

1. Use a clean production build from an immutable source SHA on the isolated target only. Record Node.js/Next.js versions, host CPU/RAM, container limits, cache configuration, and data run ID.
2. Seed controlled 10k and 100k synthetic datasets only after target-identity preflight passes. Never use production data or credentials.
3. For each scale, capture cold and warm samples for home, catalog, a real product detail, a category page, comparison, wishlist, and cart. State whether PIM/API cache, browser cache, and image cache were cleared.
4. Capture server response timing, response size, browser trace, route chunks, LCP image, LCP, INP/TBT proxy, CLS, TTFB, memory/CPU, and error rate.
5. Run the guarded Lighthouse matrix in [06-lighthouse-report.md](06-lighthouse-report.md), retain raw JSON, and make every optimization a separate measured before/after change.
6. Update this report with actual values and artifact paths only after the corresponding run completes.

## 8. Phase 05.1 performance matrix

| Measurement | Baseline | Current Phase 05.1 result | Acceptance state |
| --- | --- | --- | --- |
| Production build | Phase 05 reported pass | Passed locally on 2026-07-20 (Next.js compile 11.0s; observed wall 63.0s) | Informational only |
| First Load JS | Home ~224 kB; product detail ~229 kB | Home 224 kB; catalog 227 kB; detail 229 kB; compare 200 kB | Informational only |
| 10k/100k PIM API/SQL | Prior Phase 04.1 baseline exists | Not a storefront run | Not accepted for Phase 05.1 |
| Server/page rendering | No prior value | Not run | Missing |
| Image/CDN/LCP | No prior value | Not run | Missing |
| Desktop/mobile Lighthouse | No prior value | Not run | Missing |
| Cache/revalidation | No prior value | Not run | Missing |

## 9. Approval rule

Phase 05.1 application performance is unapproved until measurements are reproducible on the isolated target, raw artifacts are retained, regression budgets are documented, and the required Lighthouse and database/API gates pass. A successful build and prior Phase 04.1 database evidence are foundations, not substitutes for those results.
