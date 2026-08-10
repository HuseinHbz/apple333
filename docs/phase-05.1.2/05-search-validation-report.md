# Phase 05.1.2 - Module 05: Search validation report

**Status:** BLOCKED - no isolated database search evaluation executed.

**Evidence date:** 2026-07-20

**Scope:** source review, fail-closed evaluator preflight, and unit tests only.
**Production, staging, database, index, extension, migration, and deployment activity:** none.

## Decision

The search architecture decision is **deferred**. Neither Option A
(PostgreSQL FTS plus pg_trgm) nor Option B (OpenSearch) is approved by this
phase. No index, extension, schema change, or migration proposal is created
because there is no scale, latency, plan, or relevance evidence from a real
isolated database.

## Current implementation evidence

The public catalog repository currently builds case-insensitive contains
predicates for product name, brand, summary, and slug. PostgreSQL plans must be
captured to establish the exact emitted SQL and access method; source review
alone must not be presented as a measured index claim. The repository declared
architecture describes the current state as no dedicated search index and no
typo ranking.

The storefront includes useful query-side input foundations:

- Unicode and Arabic/Persian character normalization;
- normalization of digits, diacritics, tatweel, zero-width characters,
  separators, case, and whitespace;
- bounded curated synonym/typo candidates for selected iPhone, AirPods, and
  MacBook terms; and
- a browser adapter that retains the primary public PIM response as
  authoritative and marks multi-candidate merged output as approximate.

This is not database full-text search, typo ranking, a Persian analyzer, or
relevance evidence. The synthetic performance fixture currently contains
English synthetic product names and marker text; it does not by itself form the
required Persian/Arabic/synonym/typo relevance corpus.

## Local preflight and unit-test evidence

The workstation has no Docker command, PostgreSQL client/server, or database
URL. Invoking the evaluator without its required test-only environment failed
before Prisma could be constructed:

~~~text
node scripts/evaluate-storefront-search.mjs
Storefront search evaluation preflight failed: NODE_ENV must be exactly "test".
APPLE333_PIM_TEST_DB must be exactly "1". PIM_TEST_DATABASE_URL is required.
STOREFRONT_SEARCH_EVALUATION_ALLOW_READ must be exactly "1".
~~~

That expected exit code proves only that the evaluator refuses an unspecified
target. It is not a search result, plan, relevance, or latency measurement.

The following source-only unit tests passed locally with no database
connection:

~~~text
pnpm exec vitest run tests/unit/storefront-search-evaluation.test.ts \
  tests/unit/storefront-search-foundation.test.ts

2 test files passed; 12 tests passed.
~~~

They validate the evaluator environment gate and safe plan summarization, plus
normalization, curated candidate expansion, public-API-only transport, and
approximate merge behavior. They do not validate returned catalog data, Persian
recall, ranking, PostgreSQL extensions, or query performance.

## Evaluator capability and limits

When all safeguards are satisfied, scripts/evaluate-storefront-search.mjs uses
the dedicated PIM test URL and read-only SQL to:

1. list currently installed pg_trgm and unaccent extensions;
2. list existing CatalogProduct indexes;
3. run one ILIKE-style contains plan;
4. run one to_tsvector(simple, ...) / websearch_to_tsquery(simple, ...) plan;
   and
5. run one similarity / percent-operator trigram plan only when pg_trgm is
   already installed.

It requests EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) and emits execution time,
planning time, root node, and index names. It does **not** retain raw plans,
summarize buffer values, execute repeated samples, calculate p50/p95/p99,
invoke the public API, or compare results with a relevance oracle. It does not
install an extension or create an index.

## Required validation matrix

No real evidence exists for any row below. “Foundation” does not mean
validated behavior.

| Scenario | Current foundation | Isolated database plan/result evidence | User-facing relevance evidence | Status |
| --- | --- | --- | --- | --- |
| Correct Persian terms | Query normalization | None | None | Not validated |
| Arabic/Persian character variants | Query normalization | None | None | Not validated |
| Arabic/Persian digits | Query normalization | None | None | Not validated |
| Partial words | Current contains query | None | None | Not validated |
| Curated typo variants | Bounded candidate expansion | None | None | Not validated |
| Curated synonyms | Bounded candidate expansion | None | None | Not validated |
| Existing PostgreSQL contains search | Evaluator path | None | None | Not validated |
| PostgreSQL FTS | Evaluator path | None | None | Not validated |
| pg_trgm | Conditional evaluator path | None | None | Not validated |

## Required isolated Linux CI / staging-worker sequence

This procedure is for a future authorized execution, not evidence that it has
already occurred. Use the exact guarded disposable PIM database described in
[03-dataset-validation-report.md](03-dataset-validation-report.md), not a
shared staging or production database.

1. Provision and validate the disposable database with NODE_ENV=test,
   APPLE333_PIM_TEST_DB=1, and the dedicated loopback-only
   PIM_TEST_DATABASE_URL. Run pnpm pim:test:preflight and
   pnpm pim:test:migrate before the fixture writer.
2. Seed each benchmark scale on its own fresh target and retain the marker and
   relation-count verification. Before treating the execution as Persian
   validation, introduce a separately reviewed deterministic synthetic corpus
   covering Persian/Arabic variants, digits, partial terms, typo cases, and
   synonym expectations. Do not substitute production catalog or customer
   search data.
3. Run the existing evaluator with its explicit read-only opt-in for each
   documented term. Values below are placeholders and must be injected as
   non-production CI secrets/environment values rather than committed.

   ~~~bash
   export NODE_ENV=test
   export APPLE333_PIM_TEST_DB=1
   export PIM_TEST_DATABASE_URL='postgresql://apple333_pim_test:<injected-secret>@127.0.0.1:55432/apple333_pim_test?schema=public'
   export DATABASE_URL="$PIM_TEST_DATABASE_URL"
   export STOREFRONT_SEARCH_EVALUATION_ALLOW_READ=1

   for term in 'iphone' 'آیفون' 'ايفون' 'ایفون' 'airpodz'; do
     STOREFRONT_SEARCH_EVALUATION_TERM="$term" \
       node scripts/evaluate-storefront-search.mjs
   done
   ~~~

4. Capture the emitted evidence and a redacted raw-plan artifact for every
   query/scale. Record PostgreSQL version, installed extensions, existing
   indexes, fixture marker, runner limits, result IDs/counts, expected-result
   checks, planning/execution time, buffers, rows, root node, sequential scan,
   and index use. Repeat samples sufficiently to calculate p50/p95/p99; the
   current evaluator alone does not perform that aggregation.
5. Measure the user-facing public catalog path separately from SQL plans. The
   request must exercise the same normalized query and public API contract, and
   its responses must be evaluated for exact expected matches, false positives,
   false negatives, ordering, status, and latency.

## Decision criteria after evidence exists

### Option A - PostgreSQL FTS plus pg_trgm

Consider this only if the measured 10k/100k corpus demonstrates acceptable
relevance and phase latency targets, and an approved migration proposal covers
the exact query expression, extension installation, index build/write cost,
rollback, application compatibility, and Persian normalization behavior. The
current simple FTS evaluator query is an evaluation candidate, not a production
Persian-search design.

### Option B - OpenSearch future architecture

Consider this only if measured PostgreSQL alternatives cannot meet relevance,
latency, scale, or operational requirements. A separate decision must then
define a PIM-owned source of truth, audited change publication, idempotent
reindex and full rebuild, index lag/failure recovery, access control, backup,
observability, and rollout/rollback. No OpenSearch cluster, index, or sync
pipeline exists today.

## Conclusion

Search has fail-closed tooling and source-level foundations but no actual
database or user-facing validation. Module 05 is **not approved**, and it
does not authorize a PostgreSQL or OpenSearch migration.
