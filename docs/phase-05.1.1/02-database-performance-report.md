# Phase 05.1.1 — Module 02: Database performance report

**Status:** **BLOCKED — not executed**
**Review date:** 2026-07-20
**Scope:** static review and local prerequisite checks only
**Database, migration, seed, benchmark, production, and staging access:** none

## Decision

No Phase 05.1.1 database benchmark has been executed. There is no 10,000- or
100,000-product fixture run, `EXPLAIN (ANALYZE, BUFFERS)` artifact, SQL
p50/p95, API p50/p95, or query-plan result for this phase. The required
`p95 < 250ms` database/API acceptance target is therefore **not evaluated**.

This report must not be read as approval to create, migrate, seed, reset, or
benchmark a shared, staging, or production database.

## Evidence boundary and prerequisite checks

The local workstation has no reachable Docker daemon, PostgreSQL client/server,
or Redis service. No database URL was supplied. The following guard was
intentionally invoked without its explicit test-only variables:

```text
pnpm pim:test:preflight
PIM test environment preflight failed:
NODE_ENV must test
APPLE333_PIM_TEST_DB must 1
PIM_TEST_DATABASE_URL required
```

The failure is expected and establishes only that the benchmark path refuses an
unqualified target. It is not a benchmark result.

`scripts/seed-performance-data.ts` is the deterministic fixture writer prepared
in Phase 05.1. It supports controlled 10k/100k data scales, but it is **not a
benchmark**. Before it creates a Prisma client it requires an explicit
test-only environment, a loopback-only isolated PIM target, a completed
Phase 04.1 baseline, a write opt-in, and a new complete run identifier. It
rejects a partial or reused run instead of repairing or deleting data.

## Required measurement matrix

| Required query / endpoint | 10k evidence | 100k evidence | Plan / index evidence | p50/p95 | Status |
| --- | --- | --- | --- | --- | --- |
| Product listing | None | None | None | None | Not executed |
| Category listing | None | None | None | None | Not executed |
| Product detail | None | None | None | None | Not executed |
| Filtering | None | None | None | None | Not executed |
| Sorting | None | None | None | None | Not executed |
| Search | None | None | None | None | Not executed |
| Sitemap generation | None | None | None | None | Not executed |

No sequential-scan, buffer, planning-time, execution-time, status-code, or
slow-query evidence exists for the Phase 05.1.1 storefront matrix.

## Historical evidence — explicitly excluded from this acceptance

Phase 04.1 recorded a real, isolated PostgreSQL 16.6 PIM benchmark. It is
useful baseline context, but it is **not Phase 05.1.1 storefront evidence**:
the harness did not cover this phase's full filter, sorting, search, sitemap,
rendering, cache, or API matrix.

| Historical PIM scale | SQL p95 listing / category / detail | HTTP p95 listing / category / detail / categories | Source |
| --- | --- | --- | --- |
| 10,000 products | 16.271 / 15.727 / 0.156ms | 94.875 / 26.302 / 18.161 / 4.729ms | [Phase 04.1 performance report](../phase-04.1/06-performance-report.md) |
| 100,000 products | 59.887 / 47.034 / 0.138ms | 117.225 / 105.905 / 12.979 / 4.392ms | [Phase 04.1 performance report](../phase-04.1/06-performance-report.md) |

Those values must never be copied into this phase's acceptance table or
presented as a current storefront p95 measurement.

## Required evidence-completion procedure

Only after an operator provisions a disposable, isolated target:

1. Confirm the target through the existing PIM preflight. It must be the exact
   loopback, test-only database identity required by the scripts; do not point
   the harness at staging or production.
2. Apply the already-reviewed baseline only through the guarded test workflow;
   do not use `db push`, reset, truncate, or a destructive cleanup command.
3. Seed a new deterministic 10k run and then a new deterministic 100k run.
   Preserve each run identifier and fixture verification output.
4. Capture `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` for every row in the
   matrix above, preserving raw redacted plan artifacts and a summary of
   execution/planning time, buffers, index use, and sequential scans.
5. Measure repeatable API samples for the same paths, record sample count,
   percentile method, warm/cold/cache state, response status/size, p50/p95,
   and errors. A p95 below 250ms is required for every accepted target.
6. Record only sanitized target identity and timings in the evidence; never
   publish connection strings, passwords, fixture payloads, or customer data.

## Conclusion

Module 02 has safe deterministic tooling but no execution evidence. It is
**not approved**, and Phase 05.1.1 cannot claim database or API performance
readiness.
