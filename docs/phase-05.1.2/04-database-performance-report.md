# Phase 05.1.2 - Module 04: Database performance report

**Status:** BLOCKED - no Phase 05.1.2 database or API benchmark executed.

**Evidence date:** 2026-07-20

**Scope:** static tooling review and local prerequisite check only.
**Production, staging, database, seed, migration, benchmark, and deployment activity:** none.

## Decision

There is no Phase 05.1.2 EXPLAIN (ANALYZE, BUFFERS) artifact, no SQL/API p50,
p95, or p99 measurement, and no execution evidence at either 10,000 or
100,000 products. The required p95 < 250ms target is therefore **not
evaluated** and this module is not approved.

The repository has a historical Phase 04.1 PIM benchmark and useful guarded
benchmark tooling. Neither is current storefront acceptance evidence. No
historical metric is copied into a Phase 05.1.2 result table.

## Current local prerequisite evidence

On 2026-07-20, the local validation workstation reported Node.js v24.14.0 and
pnpm 11.9.0, but no Docker command, psql command, redis-cli, or
PostgreSQL/Redis/Docker service. No database URL was supplied.

The intentionally incomplete preflight produced the expected refusal:

~~~text
pnpm pim:test:preflight
PIM test environment preflight failed:
- NODE_ENV must be exactly "test".
- APPLE333_PIM_TEST_DB must be exactly "1".
- PIM_TEST_DATABASE_URL is required.
~~~

This validates only the string-level safety gate. It did not create a Prisma
client or establish a database connection; it is not an availability, seed, or
performance result.

## Historical Phase 04.1 PIM baseline - excluded from this acceptance

The approved Phase 04.1 report records a real benchmark on GitHub-hosted
ubuntu-latest, PostgreSQL 16.6, and a disposable apple333_pim_test database.
Its source commit was b82bef573928393ab79354102b6d196cdd33c280; the linked
workflow run was 29238326931, job 86778151181. The report identifies an
uploaded evidence artifact and explicitly states that no shared development or
production target was used.

| Historical scale | SQL p95: listing / category listing / detail | SQL p95: SKU / workflow | HTTP p95: listing / category listing / detail / categories |
| --- | --- | --- | --- |
| 10,000 products | 16.271 / 15.727 / 0.156ms | 0.055 / 0.050ms | 94.875 / 26.302 / 18.161 / 4.729ms |
| 100,000 products | 59.887 / 47.034 / 0.138ms | 0.068 / 0.066ms | 117.225 / 105.905 / 12.979 / 4.392ms |

Those figures came from five samples per measured path. The Phase 04.1 SQL
execution-time threshold was <= 250ms; its public HTTP threshold was
<= 3000ms. Its coverage was public listing, category-filtered listing,
product detail, category list, import-SKU validation, and workflow history.

The historical harness did **not** establish the Phase 05.1.2 acceptance
matrix: it did not measure the current storefront color/storage/price/stock
filters, all sort modes, Persian search, compare behavior, sitemap generation,
server-component rendering, cache behavior, or the requested API p99 values.
It is therefore useful engineering context only. Source:
[Phase 04.1 performance report](../phase-04.1/06-performance-report.md).

## Existing tooling and coverage gap

| Tool | What it can safely provide | What it does not provide for this phase |
| --- | --- | --- |
| scripts/seed-performance-data.ts | Deterministic synthetic 10k/100k storefront-shaped records, self-verification, and isolated-target checks | No query plans, API samples, p50/p95/p99, or automatic cleanup |
| scripts/benchmark-pim-catalog.mjs / pnpm pim:benchmark | Five serialized EXPLAIN samples for the historical PIM paths and five API samples for its four public endpoints | The complete Phase 05.1.2 filter/sort/search/sitemap matrix or p99 API metrics |
| scripts/evaluate-storefront-search.mjs | One guarded read-only plan each for contains and FTS, plus optional trigram plan | Repeated timings, p50/p95/p99, relevance judgments, raw plan retention, or non-search paths |

pim:benchmark also writes its own historical PIM fixture. It must not be run
against the same retained database as the Phase 05.1.2 generator merely to
produce a broader-looking report. A future execution must define one fixture
marker and one measured-path harness per ephemeral target.

## Required Phase 05.1.2 matrix

No row below has a result. “Not run” must remain visible until raw, redacted
artifacts are collected on an isolated target.

| Scale | Surface | SQL planning/execution/buffers/indexes | API p50 / p95 / p99 | Result |
| --- | --- | --- | --- | --- |
| 10k | Product listing | Not run | Not run | Not accepted |
| 10k | Category listing | Not run | Not run | Not accepted |
| 10k | Product detail | Not run | Not run | Not accepted |
| 10k | Color, storage, price, stock, and collection filtering | Not run | Not run | Not accepted |
| 10k | Featured, newest, name, price ascending, and price descending sorting | Not run | Not run | Not accepted |
| 10k | Search | Not run | Not run | Not accepted |
| 10k | Sitemap generation | Not run | Not run | Not accepted |
| 100k | Product listing | Not run | Not run | Not accepted |
| 100k | Category listing | Not run | Not run | Not accepted |
| 100k | Product detail | Not run | Not run | Not accepted |
| 100k | Color, storage, price, stock, and collection filtering | Not run | Not run | Not accepted |
| 100k | Featured, newest, name, price ascending, and price descending sorting | Not run | Not run | Not accepted |
| 100k | Search | Not run | Not run | Not accepted |
| 100k | Sitemap generation | Not run | Not run | Not accepted |

## Required isolated Linux CI / staging-worker procedure

This is the safe execution sequence for a future authorized job; it was not
run here. The database must be a brand-new disposable service published only
to the runner as 127.0.0.1:55432. “Staging worker” means an isolated test
worker, not the deployed apple333-staging application database.

1. Record source SHA, runner image, Node.js version, PostgreSQL version,
   allocated CPU/memory, fixture run ID, and cold/warm-cache definition before
   creating the service.
2. Validate and migrate the empty disposable target using only the existing
   guarded path:

   ~~~bash
   export NODE_ENV=test
   export APPLE333_PIM_TEST_DB=1
   export PIM_TEST_DATABASE_URL='postgresql://apple333_pim_test:<injected-secret>@127.0.0.1:55432/apple333_pim_test?schema=public'

   pnpm prisma:validate
   pnpm prisma:generate
   pnpm pim:test:preflight
   pnpm pim:test:migrate
   ~~~

3. On a fresh target for each scale, seed the deterministic fixture using the
   runbook in [03-dataset-validation-report.md](03-dataset-validation-report.md).
   Preserve the self-verification and read-only count evidence before starting
   the application.
4. Build and start the application on the same isolated target. Use a loopback
   listener and artifact collection; never substitute the production domain or
   credentials. Record HTTP status, response bytes, sample count, timeout,
   percentile algorithm, and cache state for every endpoint.
5. Collect repeated, serialized EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) output
   for every row in the required matrix. Persist redacted raw JSON as a CI
   artifact, then summarize planning time, execution time, buffers, root node,
   rows scanned/returned, sequential scans, and index names. Do not run the
   plan samples concurrently.
6. Calculate p50, p95, and p99 from a documented sample count for each API
   path; keep SQL plan timing separate from end-to-end API timing. The phase
   p95 < 250ms requirement cannot be declared met until its scope and each
   accepted path are recorded in the artifact.
7. Treat an unexpected sequential scan, missing index, latency breach, or
   search result issue as a review trigger. If a schema, extension, or index
   change is indicated, stop and create a migration proposal with rollback and
   write-cost analysis. Do not apply a database change in an evidence-only run.

## Conclusion

The available tools are safety-conscious foundations, and the Phase 04.1
measurements are valid historical PIM evidence. They do not satisfy the real
Phase 05.1.2 storefront benchmark. Database performance remains **not
approved** pending two real isolated executions and complete retained evidence.
