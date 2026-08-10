# Phase 05 — Storefront Performance Report

## Scope

This report records the performance-oriented implementation choices and the
available build evidence for the Premium Storefront. It intentionally separates
measured build output from metrics that have not yet been measured in a stable,
production-like environment.

No production database, production deployment, or destructive data operation
was used to produce this report.

## Implemented performance controls

### Server composition and caching

- Home, catalog, category, product, and comparison composition use the typed
  public PIM projection on the server.
- Public server catalog data is protected by `unstable_cache` with a 60-second
  revalidation period.
- Storefront pages declare the same 60-second ISR revalidation intent.
- Client-side code remains for interaction-heavy islands such as gallery,
  filters, comparison selection, cart, and guest wishlist rather than moving
  core catalog data loading entirely into the browser.
- Guest/cart/wishlist state is not stored in a public shared cache.

### Assets and bundles

- Product and marketing media use Next.js image optimization rather than the
  previous unoptimized image path.
- Product structured data derives media URLs from the public PIM projection;
  it does not eagerly ship arbitrary PIM payloads to every route.
- Search, wishlist, comparison, and cart behavior are scoped to their
  storefront routes/components, preserving the existing reusable shell and UI
  primitives instead of introducing a second application shell.

### Sitemap and build behavior

- Sitemaps enumerate public product slugs through a compact projection, not
  complete product details.
- Sitemap shards are generated at runtime so `next build` does not need a
  production database connection.

## Available build evidence

The latest successful production build reported approximately:

| Route family | First Load JS (approx.) |
| --- | ---: |
| Home | 224 kB |
| Product detail | 229 kB |

These values are useful regression indicators, not browser performance scores.
They include framework/shared assets as reported by the build and can vary with
Next.js, build environment, and route changes. They must be re-recorded after
material storefront dependency or rendering changes.

## Metrics not yet measured

The following have **not** been measured or claimed in this phase:

- Lighthouse Performance score;
- Core Web Vitals (LCP, INP, CLS, TTFB) on mobile or desktop;
- real-user monitoring data;
- image optimization behavior against the production CDN/origin;
- public PIM query latency at production catalog volume;
- cache hit ratio, revalidation latency, or invalidation behavior;
- sitemap generation duration at realistic catalog volume; and
- network/render performance under slow Persian mobile networks.

Consequently, the requested Lighthouse target cannot be marked satisfied. A
successful `next build` and first-load size are not substitutes for Lighthouse
or field measurements.

## Known performance risks

| Risk | Current mitigation | Required follow-up |
| --- | --- | --- |
| Large PIM catalog | Server cache and paginated public projections | Benchmark database queries and page rendering with representative volume. |
| Search synonym fan-out | Candidate count is bounded | Measure API fan-out and add indexed search only after approved design. |
| Product imagery | Next image optimization is enabled | Verify remote image sizing, formats, cache headers, and LCP image priority on staging. |
| Client interaction growth | Interactive behavior stays route-local | Inspect chunks after new features; enforce route bundle budgets. |
| Sitemap volume | 50k URL shards, 20-shard envelope | Measure runtime shard generation and monitor errors/crawl impact. |

## Recommended verification protocol

Before Phase 05 can be approved for production readiness:

1. provision a non-production PIM dataset representative of expected catalog,
   variants, media, and category volume;
2. run a production build and serve it in a stable local/staging environment;
3. collect Lighthouse mobile and desktop traces for home, catalog, product,
   comparison, wishlist, and cart routes;
4. record LCP image, total blocking time/INP proxy, CLS, TTFB, bundle sizes,
   API timing, and cache behavior;
5. test keyboard and screen-reader paths alongside performance changes, because
   deferring interactive content can affect accessibility; and
6. set CI budgets from measured baselines instead of guessed thresholds.

This report does not assert a completed Phase 05 performance acceptance gate.
