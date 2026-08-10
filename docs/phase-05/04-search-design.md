# Phase 05 — Public Catalog Search Design

## Goal

Phase 05 introduces a safe search foundation for Persian-language Apple
catalog discovery without bypassing the Phase 04 public PIM API. It improves
input consistency and familiar Apple query variants while making no false claim
that the present database query is a full-text or typo-tolerant search engine.

## Boundaries

The browser-facing adapter calls only the public endpoint:

```text
GET /api/store/products
```

It accepts the validated catalog contract: `query`, pagination, brand, model,
category, color, storage, price range, stock, collection, and sort. It uses
same-origin credentials and validates the public API envelope before exposing
results to a page. It never reaches Prisma, a repository, an admin PIM route,
or a direct database predicate from the browser.

Server-composed catalog pages use the equivalent public PIM service projection
for their initial render. This shares the catalog visibility rules and typed
DTOs with the API rather than creating a second product model.

## Query processing

`normalizePersianSearchTerm` applies a deliberately small, deterministic
normalization pipeline before URL construction or search execution:

1. Unicode NFKC normalization;
2. Arabic-to-Persian character normalization (for example, Yeh and Kaf
   variants);
3. Persian/Arabic digit normalization;
4. whitespace collapse and trim; and
5. removal of invisible directional/control characters that do not add search
   meaning.

The Zod input schema applies length and shape limits to this normalized value.
Catalog URL construction uses the same function, preventing a URL-state search
and an interactive search from diverging merely because of character variants.

## Synonyms and result semantics

The search module supplies a bounded Apple-domain synonym map and generates a
primary normalized candidate plus a limited set of variants. Examples include
common model/product-family wording variations rather than an unbounded,
user-provided query expansion.

The adapter sends the normalized primary query first. Optional synonyms are
queried through the same public PIM endpoint; returned products are
de-duplicated by stable product identity and limited to the requested page
size. The primary query remains authoritative for page number, total, and
total-pages. When synonym results are merged, the result is explicitly marked
`isApproximate`.

This honesty matters: merged synonym pages are not globally ranked results,
and their total cannot be presented as an exact catalog-wide total.

## What is deliberately not implemented

The PIM query currently uses ordinary public catalog matching. The following
capabilities are not present in Phase 05 and must not be inferred from the UI
or docs:

- PostgreSQL full-text indexes or `tsvector` ranking;
- trigram, edit-distance, phonetic, or typo-tolerance indexes;
- global relevance ranking across query and synonym candidates;
- faceted search totals;
- external search infrastructure such as Elasticsearch, Meilisearch, or
  Algolia; and
- analytics-driven synonym management.

The term “search foundation” therefore means safe normalization, a typed API
adapter, bounded synonyms, URL consistency, and future-replaceable interfaces
— not a completed search-engine implementation.

## Future migration path

When search quality or catalog volume warrants it, introduce a dedicated
server-side search contract before changing the UI:

1. approve relevance requirements, languages, typo behavior, synonym ownership,
   and data-retention policy;
2. benchmark the current public catalog query against production-like volume;
3. choose PostgreSQL FTS/trigram indexes or a dedicated index service based on
   measured latency and operational constraints;
4. keep the `PublicPimCatalogSearchTransport` interface and substitute an
   approved implementation behind it;
5. return a clear result model with exact/estimated total semantics and stable
   pagination/cursors; and
6. add abuse controls, rate-limit metrics, relevance tests, and monitoring.

No database schema, index, migration, crawler, or external search service is
created by this phase.

## Privacy and operational safeguards

Search terms are user input. They must be treated as untrusted at every layer:

- Zod validation limits accepted shape and normalized length;
- browser requests remain same-origin and use the already protected public PIM
  endpoint;
- API validation and rate limiting remain the enforcement point for server
  requests; and
- operational logs should avoid retaining raw query text longer than necessary
  and must not attach it to customer identity without an approved policy.

No production search analytics or user profiling is enabled here.

## Validation status

Unit coverage should exercise Persian character/digit normalization, synonym
candidate bounds, URL output, malformed response envelopes, and duplicate
result merging. Integration coverage should exercise the public API adapter
against controlled endpoint responses. E2E verification of the live catalog
requires a seeded local/test PIM data source.

No local production-database benchmark, FTS benchmark, typo-recall study, or
production query-latency result has been recorded. Those are open gates, not
successful metrics.
