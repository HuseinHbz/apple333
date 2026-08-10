# Phase 07 Runtime Evidence

## Current decision

**LOCAL CANDIDATE READY; DO NOT APPROVE YET.** All mandatory local static,
PostgreSQL, browser, reconciliation, performance, and dependency gates pass.
Approval is still blocked until the exact candidate commit passes GitHub
Actions and the retained sanitized artifacts are reviewed.

No production resource, credential, shared database, or deployment was used.

## Guarded environment

The disposable environment is defined by `.env.order-test.example` and
`docker-compose.order-test.yml`. Every database command validates these guards
before importing Prisma or connecting:

| Guard                   | Required rule                                     |
| ----------------------- | ------------------------------------------------- |
| Node environment        | `NODE_ENV=test` exactly                           |
| General acknowledgement | `APPLE333_TEST_DB=1` exactly                      |
| OMS acknowledgement     | `APPLE333_ORDER_TEST_DB=1` exactly                |
| Browser acknowledgement | `APPLE333_ORDER_E2E_TEST_DB=1` exactly            |
| Host                    | `127.0.0.1` on the dedicated port only            |
| Identity                | Phase 07 database and role names only             |
| Cleanup                 | Label ownership and database identity revalidated |

The production artifact ran only on loopback. The non-Secure cookie exception
requires the explicit E2E markers and cannot activate in a normal production
runtime. The Windows runner owns and terminates its standalone process; the
internal reuse marker is rejected if supplied by an operator.

## Final local quality results

| Gate                               | Command                          | Result                              |
| ---------------------------------- | -------------------------------- | ----------------------------------- |
| Frozen dependencies                | `pnpm install --frozen-lockfile` | PASS                                |
| Prisma validation                  | `pnpm prisma:validate`           | PASS                                |
| Prisma generation                  | `pnpm prisma:generate`           | PASS                                |
| Application types                  | `pnpm typecheck`                 | PASS                                |
| Phase 07 tooling types             | `pnpm typecheck:phase-07-tests`  | PASS                                |
| Lint                               | `pnpm lint`                      | PASS                                |
| Unit tests                         | `pnpm test`                      | PASS - 64 files / 344 tests         |
| Integration tests                  | `pnpm test:integration`          | PASS - 10 files / 73 tests          |
| PostgreSQL persistence/concurrency | `pnpm test:order-db`             | PASS - 2 files / 15 tests           |
| Production build                   | `pnpm build`                     | PASS - 97 generated routes/pages    |
| Standalone browser/Axe             | `pnpm test:e2e:orders`           | PASS - 8 / 8 in 16.3 seconds        |
| Reconciliation                     | `pnpm order:reconcile`           | PASS - 120,146 checked / 0 drift    |
| Production dependency audit        | `pnpm audit --prod --json`       | PASS - 0 findings at all severities |

The final build used the disposable PostgreSQL URL, so static generation
completed without missing-environment revalidation warnings.

## Database and migration evidence

- The additive migration
  `20260729000000_phase_07_order_management` was applied only to disposable
  PostgreSQL.
- The inspected database contained the expected Phase 07 migration marker and
  56 public tables.
- Persistence, restart idempotency, immutable snapshot, rejection audit,
  customer query scope, final-stock concurrency, and tracked-device concurrency
  tests all passed.
- No `prisma db push`, migration reset, drop, or production migration was used.

## Browser evidence

The production standalone artifact passed eight scenarios covering:

- cart-to-order creation and durable replay;
- customer list/detail/cancel and cross-customer denial;
- staff create, allocate, confirm, payment metadata, fulfillment, and cancel;
- internal-note and sensitive-field privacy;
- keyboard focus and core Axe accessibility rules.

Candidate stabilization exposed and fixed a production-only Request identity
bug, a nondeterministic product-variant fixture, two contrast issues, invalid
ARIA on loading skeletons, and Windows standalone teardown. No test was skipped,
retried away, or weakened.

## Performance evidence

Both requested PostgreSQL scales passed. External/provider latency is not
included; write measurements cover the durable persistence shape.

| Dataset | Operation           | Observed p95 |
| ------: | ------------------- | -----------: |
|     10k | Admin list          |     1.947 ms |
|     10k | Customer list       |     1.697 ms |
|     10k | Branch list         |     3.140 ms |
|     10k | Detail              |     4.587 ms |
|     10k | Search              |     1.315 ms |
|     10k | Create persistence  |    19.067 ms |
|     10k | Confirm persistence |     9.935 ms |
|    100k | Admin list          |     1.986 ms |
|    100k | Customer list       |     2.430 ms |
|    100k | Branch list         |     3.656 ms |
|    100k | Detail              |     5.092 ms |
|    100k | Search              |     1.286 ms |
|    100k | Create persistence  |    20.977 ms |
|    100k | Confirm persistence |    10.710 ms |

The successful 10k seed completed in 12.233 seconds; the 100k seed completed in
122.218 seconds. A preliminary 10k run correctly failed on an enum/text raw SQL
comparison. The query was fixed by casting the parameter to `OrderStatus`
without casting the indexed column, regression coverage was added, and both
scales were repeated successfully.

## Remaining approval gate

The workflow `.github/workflows/phase07-order-evidence.yml` must pass for the
exact candidate commit. A normal push runs quality, disposable migration,
database/concurrency, E2E, security, reconciliation, and 10k evidence. The 100k
job must be explicitly dispatched for the same commit. Retained artifacts must
then be reviewed for sanitization and completeness.

Until that evidence exists, Phase 08 remains blocked.
