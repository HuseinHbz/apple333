# Phase 06.1 - Full Quality Gate Report

## Evidence classification

This document distinguishes actual successful local runtime evidence from the
remaining approval blockers. No gate is marked passing merely because tooling
exists.

## Completed gates

| Gate                               | Result | Actual evidence                                                                      |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| `pnpm typecheck`                   | PASS   | Re-run passed on 2026-07-22.                                                         |
| `pnpm lint`                        | PASS   | Re-run passed on 2026-07-22.                                                         |
| `pnpm test`                        | PASS   | 51 files / 267 tests passed.                                                         |
| `pnpm test:integration`            | PASS   | 9 files / 59 tests passed.                                                           |
| `pnpm typecheck:phase-06-tests`    | PASS   | Re-run passed on 2026-07-22.                                                         |
| Production build                   | PASS   | Next.js 15.5.18 build passed with 92 pages.                                          |
| Standalone preparation             | PASS   | Completed before the production-mode E2E re-test.                                    |
| Isolated service preflight/health  | PASS   | Labelled loopback PostgreSQL and Redis test services healthy.                        |
| Guarded migration                  | PASS   | Fresh isolated re-test applied the 2 existing migrations; inspector found 46 tables. |
| PostgreSQL persistence/concurrency | PASS   | 2 files / 13 tests passed.                                                           |
| Seed idempotency                   | PASS   | Controlled seed passed twice after fixture corrections.                              |
| Fresh E2E-only reconciliation      | PASS   | Fresh labelled resources: 12 canonical / 12 projection / 0 drift after E2E.          |
| Production runtime/readiness       | PASS   | HTTP 200; configuration/database/Redis all `ok`.                                     |
| Inventory E2E                      | PASS   | Independent fresh re-run: 17 / 17 passed in 18.0s.                                   |
| 10k benchmark                      | PASS   | All recorded p95 metrics below 250 ms; index scans used.                             |
| 100k benchmark                     | PASS   | All recorded p95 metrics below 250 ms; index scans used.                             |

## Gates still blocking approval

| Gate                                     | Status               | Reason                                                                                                            |
| ---------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Production dependency audit              | **FAILED / BLOCKED** | Latest audit: `critical=0`, `high=2`, `moderate=3`; no remediation or formal risk acceptance is recorded.         |
| Full RBAC actor matrix                   | PARTIAL              | Exercised runtime paths passed, but not every required actor profile/end-point matrix was independently executed. |
| Fixture isolation / projection semantics | **BLOCKED**          | Database-suite-plus-E2E reconciliation reported 2 drifts; no code change or semantic decision has been made.      |
| CI workflow and artifacts                | NOT EXECUTED         | The workflow has not run for this evidence set.                                                                   |

## Reconciliation exception and independent verification

The first reconciliation after running the database suite and E2E reported
`canonical=21`, `projection=21`, and `drift=2`. Investigation located the
source in `tests/database/inventory-persistence.test.ts:341-360`: the fixture
directly creates a three-unit `DAMAGED` `InventoryItem`, bypassing the service
path that updates the legacy `BranchInventory` projection. E2E was not the
source of this drift.

No code was changed. Instead, only verified labelled Phase 06 Docker resources
were independently recreated and migrated. The fresh E2E run passed 17/17 in
18.0 seconds and its reconciliation passed with `canonical=12`,
`projection=12`, and `drift=0`.

The original database-suite-plus-E2E sequence must **not** be represented as a
reconciliation pass. A fixture-isolation remedy and an explicit decision on
whether `BranchInventory` represents physical or sellable inventory remain
required.

## Re-test note

The first latest E2E attempt stopped at preflight, before the browser suite,
because the ignored local `.env.inventory-test` file had been created before
`INVENTORY_TEST_REDIS_URL` existed. The re-run supplied the explicit local
loopback Redis variable and then completed standalone preparation and all 17
browser scenarios successfully. This was an environment-preflight failure,
not a skipped or hidden E2E test failure.

## Quality-gate conclusion

**NOT A FULL PASS / DO NOT APPROVE.** The local database, runtime, browser,
and benchmark gates have real passing evidence, including an independently
clean E2E/reconciliation run. Approval remains blocked by the unresolved
High/Moderate production dependency audit, incomplete actor matrix coverage,
fixture isolation and `BranchInventory` semantic-contract work, and missing CI
execution/artifacts.

No production database, shared service, or deployment target was used.
