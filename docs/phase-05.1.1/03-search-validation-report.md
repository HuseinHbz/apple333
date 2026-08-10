# Phase 05.1.1 — Module 03: Search validation report

**Status:** **BLOCKED — no isolated search evaluation executed**
**Review date:** 2026-07-20
**Scope:** source/unit-test review and fail-closed evaluator preflight
**Database, production, staging, migration, index, and extension changes:** none

## Decision

The Phase 05.1.1 search decision is **deferred**. Neither PostgreSQL FTS plus
`pg_trgm` (Option A) nor an OpenSearch migration path (Option B) is approved
from source inspection alone. No schema/index change or migration review is
proposed in this phase.

## Current implementation evidence

The public catalog's current database-side behavior is case-insensitive
matching through the existing Prisma/catalog path, which results in PostgreSQL
`ILIKE`-style contains matching. It has no accepted dedicated full-text or
trigram index, no measured typo ranking, and no measured synonym relevance.

There is source/unit-test evidence for client-side Persian/Arabic query
normalization and a bounded curated synonym/typo candidate adapter. This is
useful input hygiene, not database search-quality evidence: it does not prove
the candidate reaches the public catalog query, relevance ordering, recall,
or performance at scale.

## Evaluator safety check

`scripts/evaluate-storefront-search.mjs` was invoked without the explicit
isolated-test environment and failed before creating a Prisma client:

```text
Storefront search evaluation preflight failed:
NODE_ENV must be exactly "test".
APPLE333_PIM_TEST_DB must be exactly "1".
PIM_TEST_DATABASE_URL is required.
STOREFRONT_SEARCH_EVALUATION_ALLOW_READ must be exactly "1".
```

This is expected. The evaluator only accepts the existing guarded PIM test
target and an explicit read opt-in. It does not contact an arbitrary database.

If safely executed, the current evaluator would inspect installed `pg_trgm` and
`unaccent` extensions, list `CatalogProduct` indexes, and collect JSON plans
for one `ILIKE` query, one simple PostgreSQL FTS query, and an optional
single-field trigram query. It does **not** yet retain raw plans, run repeated
samples/p50/p95, or exercise the full user-relevance corpus.

## Required validation matrix

| Scenario | Source/unit foundation | Isolated database evidence | User-facing relevance evidence | Status |
| --- | --- | --- | --- | --- |
| Persian text | Normalization helper exists | None | None | Not validated |
| Arabic/Persian character variants | Normalization helper exists | None | None | Not validated |
| Common typos | Curated candidate foundation exists | None | None | Not validated |
| Synonyms | Bounded candidate foundation exists | None | None | Not validated |
| Partial matches | Current contains query exists | None | None | Not validated |
| FTS capability | Evaluator path exists | None | None | Not validated |
| `pg_trgm` capability | Evaluator path exists | None | None | Not validated |

No Phase 05.1.1 timing, index-use, sequential-scan, result-set, or ranking
artifact exists for any row above.

## Option assessment

### Option A — PostgreSQL FTS plus `pg_trgm`

Potentially appropriate if measured queries show the existing PostgreSQL
deployment can meet the catalog's relevance and latency requirements. It
would require a separately reviewed migration plan for extensions, generated
search documents/indexes, write/update costs, rollback/adoption behavior, and
Persian language behavior. No such plan has been accepted or executed.

### Option B — OpenSearch migration path

Potentially appropriate only if a measured PostgreSQL design cannot satisfy
the required scale, relevance, operational, and recovery requirements. It
would require a separate sync/source-of-truth, indexing failure, reindex,
access-control, cost, backup, and observability design. No migration path has
been accepted or executed.

## Required next cycle

1. Create a synthetic search corpus on the guarded isolated target; include
   Arabic/Persian variants, partial terms, curated synonyms, and documented
   typo cases without customer data.
2. Run the evaluator and a revised repeatable matrix for each query family;
   retain raw redacted JSON plans and result-quality expectations.
3. Measure p50/p95, execution/planning time, buffers, index use, sequential
   scans, result ordering, and false-positive/false-negative examples at both
   required data scales.
4. Compare the measured PostgreSQL paths to explicit relevance/latency
   budgets. Only then write a migration review for Option A or a technical
   decision record for Option B.
5. Do not install extensions, create indexes, or change schemas until the
   separate review is approved for a disposable test target.

## Conclusion

Search has safe source foundations and a guarded evaluator, but no real search
validation. Module 03 is **not approved** and it does not authorize a
PostgreSQL or OpenSearch migration.
