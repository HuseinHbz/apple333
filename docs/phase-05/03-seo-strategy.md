# Phase 05 — Storefront SEO Strategy

## Purpose and scope

This document records the SEO implementation for the Premium Apple Commerce
Storefront. It applies only to published, public PIM data and public storefront
routes. It does not add product content, synthetic reviews, a crawler, or any
database migration.

The source of truth remains the Phase 04 public PIM projection. Server-rendered
storefront code uses the same service contracts that power the public
`/api/store/*` routes; it does not query admin-only PIM models or duplicate
catalog visibility rules.

## Rendering and freshness

Home, catalog, category, and product routes are server-composed and declare a
60-second revalidation policy. `src/features/storefront/services/server-catalog.ts`
uses an `unstable_cache` boundary with the same 60-second value for public
categories, catalog pages, product detail, and comparisons. This gives public
content an ISR/data-cache path while keeping cart, wishlist, and other
personalized interaction state out of shared server caches.

The public API response cache remains independently bounded by its route
policy (`s-maxage=60`, `stale-while-revalidate=300`). Cache invalidation and
catalog publication events must be validated during a later PIM lifecycle
integration; this phase does not claim instant invalidation.

## Metadata policy

The root metadata configuration establishes:

- `metadataBase` from the validated `APP_URL` origin, with a safe localhost
  fallback for local development;
- Persian locale (`fa_IR`), site name, Open Graph, and Twitter defaults;
- a canonical storefront home URL.

Every product route calls `generateMetadata` from the typed public product
projection. Product metadata uses, in order:

1. curated PIM SEO title/description where present;
2. the public product name, summary, or description as truthful fallback;
3. a canonical URL supplied by PIM only when it has the configured storefront
   origin; otherwise the canonical product URL is generated locally;
4. the public hero image for Open Graph/Twitter when one exists; and
5. the PIM `noIndex` flag to emit `noindex, nofollow` rather than exposing an
   unpublished or intentionally excluded product to search engines.

This origin check prevents a PIM field from injecting an off-site canonical
URL. Missing products return a non-indexable metadata response and then the
route renders Next.js `notFound()`.

## Structured data

The storefront emits JSON-LD through one escaped script component. The JSON
serializer replaces `<` before writing `application/ld+json`, so text from the
public product projection cannot terminate the script element.

For a valid public product the page emits:

- `Product`: name, SKU fallback, Apple brand value, category, truthful
  description, and non-video PIM media;
- `Offer`: price in IRR, public stock availability, and canonical product URL;
- `BreadcrumbList`: home, products, optional category, and current product;
- root-level `Organization`: Apple333 name, home URL, and logo URL.

`Review`, `AggregateRating`, and rating snippets are **intentionally absent**.
There is no verified review/ratings source in the public PIM projection, and
inventing those fields would be misleading and invalid for rich-result policy.

## Canonical route policy

Public product pages use `/products/[slug]`. Category navigation uses
`/categories/[category]`; filtered catalog URLs remain at
`/products?category=<slug>`. This avoids the App Router collision that would
occur if both category and product occupied `/products/[dynamic-segment]`.

Search and filtering URLs must be canonicalized in a later search-SEO review
once the business policy for indexable filter combinations is approved. The
current implementation should not manufacture canonical pages for arbitrary
query permutations.

## Robots and sitemap

`robots.ts` permits public product discovery and disallows administrative,
account, API, cart, checkout, and wishlist paths. The sitemap includes public
home/catalog/comparison URLs, published categories, and published product URLs
only. Product entries are supplied by the compact public PIM sitemap
projection; it neither loads product detail objects nor exposes PIM internals.

The sitemap has a runtime shard envelope of 20 shards, with the standard
50,000 URLs per shard (up to 1,000,000 product URLs). Generation is dynamic on
purpose: the build artifact must not require production database credentials.
This is a capacity design, not a local volume benchmark. It still requires
runtime monitoring and production-scale validation before a claim of sitemap
throughput or crawl-budget suitability can be made.

## Validation status and open work

The product metadata, JSON-LD constructors, public sitemap projection, and
robots policy are covered by implementation-level tests where configured.
However, this phase has **not** recorded a Search Console inspection, rich
result validation against a live public domain, or production crawler results.

The following are deliberately deferred:

- verified review schema after a real moderation/review source exists;
- localized alternate-language links if localized content is added;
- a documented policy for indexable catalog filters and search result pages;
- cache invalidation verification following PIM publication changes; and
- production sitemap volume/crawl monitoring.

This strategy documents implemented behavior and outstanding validation; it is
not a declaration that Phase 05 is complete.
