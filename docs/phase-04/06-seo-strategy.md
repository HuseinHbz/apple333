# Phase 04 - Product SEO Strategy

## Status

**Application-layer implementation; public metadata release pending.** Product
SEO fields, canonical URL validation, schema data storage, and publication
gates are implemented in the PIM service. Existing application robots and
sitemap routes remain in place; dedicated PIM metadata/sitemap output awaits
the reviewed migration and published-data integration evidence.

No migration or production data update has been applied for this strategy.

## Objectives

- Give each published Apple product and active category one stable, canonical
  public URL.
- Produce accurate, indexable content from governed product data rather than
  marketing copy scattered across page components.
- Avoid indexing drafts, review content, empty filter pages, duplicate variant
  URLs, or unavailable internal routes.
- Retain Phase 03 storefront URL compatibility while PIM becomes the data
  source of truth.

## Source of truth and fallback policy

| SEO field | Primary PIM source | Transitional Phase 03 fallback | Public rule |
| --- | --- | --- | --- |
| URL slug | `CatalogProduct.slug` / category slug | Existing slug | Must be unique and immutable after publication except through redirect workflow. |
| Meta title | `ProductSeo.metaTitle` | Existing `seoTitle` | Use a deterministic template only when explicit content is absent. |
| Meta description | `ProductSeo.metaDescription` | Existing `seoDescription` | Must be product-specific and length-validated. |
| Canonical | `ProductSeo.canonicalPath` | Product/category public path | Same-origin absolute canonical only. |
| Indexing | Product lifecycle + `indexable` | Published status | Only published, public, non-deleted content is indexable. |
| Structured data | Product/variant/specification DTO | Existing safe fields | Render from an allow-listed projection, never raw import JSON. |

The fallback remains until a reviewed backfill report and storefront regression
tests prove parity. It must not be removed as part of an unreviewed migration.

## Canonical URL policy

- Product: `https://apple333.ir/products/{slug}`.
- Category: `https://apple333.ir/products?category={category-slug}` until a
  dedicated category route is approved.
- A variant is a selectable option inside its product canonical; it does not
  create a separate indexable URL by default.
- Sort, pagination, comparison, cart, checkout, tracking, and arbitrary filter
  query strings are non-canonical and generally non-indexable.
- Changing a published slug requires an approved redirect record, redirect
  tests, canonical update, and sitemap update. It must not silently produce a
  404.

## Publication SEO gate

A product cannot be published until the implementation validates:

1. unique normalized slug and valid category/brand;
2. public title and non-empty concise description;
3. an appropriate primary image with meaningful alt text, unless an approved
   category exception applies;
4. metadata within policy limits and a safe same-origin canonical path;
5. at least one sellable SKU/variant where product schema requires it;
6. product structured-data fields that do not expose cost, barcode, private
   stock counts, or internal workflow details.

Warnings may be allowed only when they are visibly acknowledged and recorded
in an audit event; they must never bypass safety or uniqueness constraints.

## Structured data plan

Render JSON-LD server-side from a public PIM projection:

- `Product` for the product identity, name, description, image, brand, SKU,
  and governed specifications;
- `Offer` only for a current public price and actual availability policy;
- `BreadcrumbList` for active category ancestry;
- optional `VideoObject` only for approved public videos with required
  metadata.

Structured data must not invent ratings, review counts, discounts, availability,
or shipping promises. If a value lacks a verified source, omit it.

## Sitemap and crawl controls

- Generate sitemap entries from published, indexable, non-deleted PIM records
  in stable batches; use `updatedAt` only when it reflects a public change.
- Existing `robots.ts` and `sitemap.ts` must be extended through tests, not
  replaced with static generated files.
- Exclude `/admin`, account routes, cart, checkout, import routes, unpublished
  resources, and internal API endpoints from public crawl targets.
- Use cache revalidation/tag invalidation when a product is published, archived,
  recanonicalized, or changes its indexable state.

## Content and localization policy

- Persian is the primary storefront language. Language and `dir="rtl"`
  metadata must be coherent with the rendered content.
- Product titles, technical specifications, and Apple model names may retain
  validated English tokens; transliteration must not generate duplicate slugs.
- Description, image alt text, and metadata are entered through governed fields
  with length and sanitization rules, not raw HTML insertion.
- AI-generated content, when approved in a later phase, is draft content and
  cannot publish without a human reviewer.

## Performance and measurement

- Use server-rendered metadata and cache safe public PIM projections.
- Serve optimized, dimension-aware public media; avoid blocking product HTML on
  non-essential video.
- Track organic landing-page health, index coverage, canonical conflicts, 404s,
  redirect hits, schema validation errors, and Core Web Vitals by template.
- Do not insert third-party trackers or expose visitor identifiers as part of
  Phase 04 without separate privacy approval.

## SEO verification checklist

- Unit-test metadata builders and canonical validation.
- Integration-test draft/review/archive exclusion, redirects, sitemap output,
  and cache invalidation.
- E2E-test product metadata, JSON-LD validity, breadcrumb rendering, and an
  inaccessible admin page for anonymous users.
- Review representative iPhone, iPad, Mac, Watch, AirPods, accessory, and
  category pages before enabling indexing.
