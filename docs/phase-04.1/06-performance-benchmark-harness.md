# Phase 04.1 PIM performance benchmark harness

## Purpose and boundary

`scripts/benchmark-pim-catalog.mjs` is an execution harness for the required
10,000- and 100,000-product Phase 04.1 benchmarks. It is intentionally
separate from the migration runner and does not provision a container, start
PostgreSQL, alter a schema, start the application, or clean up data. The
application must be started separately by the operator with its `DATABASE_URL`
pointing to the same isolated test database.

The harness can connect only after all of these gates pass:

- `NODE_ENV=test` and `APPLE333_PIM_TEST_DB=1`;
- a literal `127.0.0.1:55432/apple333_pim_test?schema=public` URL using the
  dedicated `apple333_pim_test` role;
- `PIM_BENCHMARK_ALLOW_SEED=1` and an explicit, unique lower-case run id;
- an unset `DATABASE_URL`, or one exactly equal to `PIM_TEST_DATABASE_URL`;
- an explicit `PIM_BENCHMARK_API_BASE_URL` exactly equal to
  `http://127.0.0.1:3000` (no hostname aliases, path, query, credentials, or
  alternate port are accepted);
- live database identity, the required PIM tables, and a completed
  `20260713000000_phase_04_1_pim_activation` migration record.

It therefore fails before any fixture insert when the target, identity, or
migration state is unsafe.

## Invocation on a disposable isolated target

First run the existing isolated migration verification:

```powershell
$env:NODE_ENV = 'test'
$env:APPLE333_PIM_TEST_DB = '1'
$env:PIM_TEST_DATABASE_URL = 'postgresql://apple333_pim_test:<password>@127.0.0.1:55432/apple333_pim_test?schema=public'
pnpm pim:test:migrate
```

Then use a new run id for every benchmark invocation:

```powershell
$env:DATABASE_URL = $env:PIM_TEST_DATABASE_URL
$env:PIM_BENCHMARK_ALLOW_SEED = '1'
$env:PIM_BENCHMARK_RUN_ID = 'phase041-benchmark-20260713'
$env:PIM_BENCHMARK_API_BASE_URL = 'http://127.0.0.1:3000'
node scripts/benchmark-pim-catalog.mjs --execute
```

Optional bounded tuning is available through `PIM_BENCHMARK_BATCH_SIZE`
(100–1000, default 500), `PIM_BENCHMARK_EXPLAIN_RUNS` (3–9, default 5),
`PIM_BENCHMARK_API_TIMEOUT_MS` (250–30,000, default 10,000), and
`PIM_BENCHMARK_API_P95_MS` (100–30,000, default 3,000). The p95 value must
not exceed the request timeout and is enforced as the HTTP quality gate.

## What it measures

For one run-marked, active category, the harness inserts products, one active
variant per product, and one active SKU per variant in transactions of bounded
batches. It reaches 10,000 products, records query evidence, then adds only
the required 90,000 fixtures and records the same evidence at 100,000
products. It captures five (by default) `EXPLAIN (ANALYZE, BUFFERS, FORMAT
JSON)` runs for:

- a public published product listing;
- a category-filtered public product listing;
- a public product-detail lookup by slug;
- the public category listing;
- an import SKU conflict-validation lookup; and
- ordered workflow history for a persisted product.

For the four public HTTP endpoints, it also makes five bounded `GET` samples
at each scale: listing, category-filtered listing, detail, and categories. It
records p50/p95 end-to-end response time, status distribution, response byte
count, and JSON shape metadata. A non-200 result or p95 latency above the
explicit threshold fails the benchmark.

The emitted `PIM_BENCHMARK_EVIDENCE` JSON contains only scale, seed duration,
p50/p95 planning and execution times, rows, root node type, buffer counts,
index names, and bounded HTTP timing/status/body-shape metadata. It never
prints a database URL, password, fixture payload, response body, or raw query
plan.

## Fixture lifecycle and limits

The harness does not issue cleanup commands. It never changes a pre-existing
record and refuses a run id if it detects any category, product, variant, or
SKU bearing that run marker. Its generated fixture rows are retained only in
the isolated test database; disposal belongs to the external ephemeral test
environment lifecycle, not this script.

Do not use this harness against a shared developer database, a deployment
database, CI state that is retained between runs, or production. A fresh
isolated PIM test database is required for each 100k run to keep measurements
meaningful and storage bounded.

## Remaining measurement requirements

The harness is not itself a performance approval. Attach its output along with
runner hardware/CPU and memory details, PostgreSQL version, fixture run id,
and the accepted latency thresholds to `06-performance-report.md`. Investigate
sequential scans, unexpected index absence, or a threshold breach in a
separate reviewed optimization change.
