# Phase 05.1 — Storefront search improvement report

## Decision and evidence status

**Status: partially implemented; not accepted as an indexed-search or performance result.**

Phase 05.1 adds safe query-side improvements and a read-only PostgreSQL evaluation harness. No Phase 05.1 database run was performed while preparing this report: there is no 10k/100k local PIM dataset, no `EXPLAIN ANALYZE` output, no p95 evidence, and no search-index decision to approve yet.

No schema, migration, index, extension, production data, or production database was changed by this work.

## Implemented behavior

| Area | Evidence | Current behavior |
| --- | --- | --- |
| Persian/Arabic normalization | `src/features/storefront/services/persian-search.ts` | Normalizes NFKC form, Arabic/Persian character variants, Arabic/Persian digits, diacritics, tatweel, zero-width characters, separators, case, and whitespace before a request is built. |
| Curated typing variants | `persian-search.ts` | Adds a small reviewed set of high-frequency iPhone, AirPods, and MacBook Persian/English misspellings such as `iphon`, `iphne`, `airpodz`, and `macbok`. These are explicit candidates, not fuzzy matching. |
| Candidate bound | `persian-search.ts` | The normalized term plus synonym/typo alternatives is capped at six unique candidates to bound browser requests and result merging. |
| PIM integration | `src/features/storefront/queries/public-pim-catalog-search.ts` | Calls only the canonical same-origin `/api/store/products` public PIM endpoint. It does not query Prisma, repositories, or PostgreSQL from the browser. |
| Result integrity | `public-pim-catalog-search.ts` | Keeps the primary PIM page authoritative for pagination/total, deduplicates optional candidate items, records unavailable optional candidates, and marks multi-candidate output as `isApproximate`. |
| Unit coverage | `tests/unit/storefront-search-foundation.test.ts` | Covers normalization, synonym expansion, curated typo variants, supported PIM filters, approximate merging, optional-request failure isolation, and no-direct-database transport. |

The adapter does not claim global relevance ranking or typo-tolerant database search. A typo expansion may add useful product candidates, but it does not change the public PIM API's canonical search semantics.

## Read-only PostgreSQL evaluation harness

`scripts/evaluate-storefront-search.mjs` is prepared for evidence collection, not a database change mechanism. Before it creates a Prisma client, it requires all of the following:

- the existing `NODE_ENV=test` / `APPLE333_PIM_TEST_DB=1` PIM test boundary;
- a dedicated loopback `apple333_pim_test` URL on the guarded test port;
- explicit `STOREFRONT_SEARCH_EVALUATION_ALLOW_READ=1` opt-in; and
- `DATABASE_URL` unset or exactly equal to `PIM_TEST_DATABASE_URL`.

When those safeguards are satisfied, it reads installed `pg_trgm` and `unaccent` extensions and `CatalogProduct` index names, then evaluates these read-only alternatives with `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`:

1. Existing `ILIKE` contains search across public product fields.
2. PostgreSQL full-text expression using `to_tsvector('simple', ...)` and `websearch_to_tsquery('simple', ...)`.
3. A trigram similarity expression, only if `pg_trgm` is already installed.

The emitted evidence retains timings, root-plan node, and index names rather than raw data rows or full query plans. Its unit tests verify the isolated environment preflight, explicit read opt-in, and safe plan summarization in `tests/unit/storefront-search-evaluation.test.ts`.

**No evaluator invocation is recorded for Phase 05.1.** Consequently, this report does not state that full text, trigram search, an index, or a response time target has passed.

## Known limitations and risk

- PostgreSQL full-text search and `pg_trgm` are only evaluated alternatives; neither extension nor index has been installed or migrated.
- The current public PIM search is not a typo-ranking engine. Candidate order is bounded query expansion, and optional results are approximate.
- Additional synonym/typo candidates can increase browser-side request count; the cap mitigates but does not measure that cost.
- Search quality has unit coverage only. It has not been assessed against a 10k or 100k synthetic catalog, Persian relevance judgments, or real user query telemetry.
- No merchant-managed alias dictionary, search analytics, click-through ranking, or OpenSearch cluster exists in the current implementation.

## Required evidence before a PostgreSQL decision

On a disposable, migrated 10k and 100k PIM database, run the guarded evaluator for a documented representative query set, including Arabic/Persian letter variants, Persian/Arabic digits, Latin product names, a curated typo, and a no-match input. Record for each run:

- exact fixture run ID and scale;
- database version, extension set, existing indexes, and hardware/container limits;
- cold and warm `EXPLAIN ANALYZE` timing, root node, and index use;
- API-level latency and response shape separately from database timing; and
- a written decision on whether a reviewed PostgreSQL migration is justified.

Do not add a full-text expression index or `pg_trgm` index solely from this report. A later reviewed migration must show the actual query shape, write cost, rollback plan, and 10k/100k evidence.

## OpenSearch migration path

OpenSearch is a future scale option, not a current dependency. The current `PublicPimCatalogSearchTransport` / adapter separation should remain the stable storefront boundary while the implementation evolves:

1. Measure and decide whether PostgreSQL search meets the documented performance and relevance needs first.
2. Define a versioned search document from the authoritative PIM projection; do not let storefront code write a second product model.
3. Publish product changes through an audited outbox/worker and support idempotent reindex plus a full rebuild from PIM.
4. Add an OpenSearch transport behind a feature flag, preserve the public search response contract, and compare relevance/latency with PostgreSQL.
5. Roll out per environment only after index health, lag, failure recovery, access control, and observability are validated.

Until that work is approved, PostgreSQL/PIM remains the sole source of truth and this storefront adapter must continue using the existing public PIM API.

## Phase 05.1 conclusion

The query-side Persian improvements and the read-only evaluator are useful foundations, but their database-performance and relevance claims remain unproven. Phase 05.1 search is **not approved** until the disposable-database measurements above are captured and reviewed.
