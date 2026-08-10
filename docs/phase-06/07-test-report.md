# Phase 06 — Test Report

## Executed evidence

The focused Phase 06 command completed successfully after tracked-device,
public availability, and API changes:

```text
vitest run tests/unit/inventory-validators.test.ts
           tests/unit/inventory-availability.test.ts
           tests/unit/inventory-rbac.test.ts
           tests/integration/inventory-api.test.ts
```

Result: **4 files passed, 90 tests passed.**

| Layer | Files | Tests | Coverage highlights |
| --- | ---: | ---: | --- |
| Unit | 3 | 60 | IMEI/serial normalization, Luhn, strict Zod parsing, device selection uniqueness, availability bands, RBAC branch scoping. |
| Integration | 1 | 30 | Admin RBAC, same-origin policy, validation, audit forwarding, cache invalidation, public safe availability endpoint. |
| Focused total | 4 | 90 | Exceeds required 40 unit and 25 integration tests. |

Strict TypeScript checking passed. Prisma generation and schema validation
passed locally using a non-routable placeholder URL; no database connection was
made by schema validation.

The dedicated Phase 06 test typecheck also passed with
`pnpm typecheck:phase-06-tests`. It checks the authored database and E2E test
sources while allowing their JavaScript-only safety wrappers to remain runtime
tools rather than loosening production TypeScript settings.

The full local Vitest suite also passed: **46 files, 249 tests**. This run did
not execute the separately gated PostgreSQL persistence suite or browser suite.

`pnpm inventory:test:preflight` passed against the exact loopback-only test
URL contract and explicitly reported that it made no database connection.

## Database suite (authored, not executed)

`tests/database/inventory-persistence.test.ts` has real PostgreSQL scenarios
for branch/warehouse creation, tracked receipt, IMEI uniqueness/rollback,
tracked transfer, device reservation/release, bulk adjustment, database check
constraints, branch-scope denial (including idempotent replays), inactive
location reservation denial, audit redaction, and safe availability.

Run it only with `pnpm test:inventory-db`, after
`pnpm inventory:test:migrate` succeeds against the guarded isolated target.
It was **not executed** here because no isolated database is provisioned. This
is a release blocker, not a skipped test.

## E2E suite (authored, not executed)

`tests/e2e/phase-06-inventory.spec.ts` contains **17 serial browser scenarios**
covering unauthenticated page protection; public four-branch availability and
identifier non-leakage; authenticated inventory/branch/warehouse/device pages;
and browser-originated receive, adjustment, transfer, reservation, and release.

Playwright collection passed with **17 tests in 1 file**. This validates test
registration only; it is not presented as a browser execution result.

Run it only with `pnpm test:e2e:inventory`; its wrapper verifies the isolated
database and seeds only clearly marked test fixtures. It was **not executed**
because the required migrated test database and local application are absent.

## Final gates

| Gate | Evidence | State |
| --- | --- | --- |
| Production TypeScript | `tsc --noEmit` | Passed locally |
| Phase 06 test TypeScript | `pnpm typecheck:phase-06-tests` | Passed locally |
| Lint | `eslint .` | Passed locally |
| Production build | `next build` with non-routable validation config | Passed locally |
| Full local Vitest | `vitest run --reporter=dot` | Passed: 46 files, 249 tests |
| Isolated target preflight | `pnpm inventory:test:preflight` | Passed without DB connection |
| PostgreSQL persistence | `pnpm test:inventory-db` | Pending isolated target |
| E2E browser | `pnpm test:e2e:inventory` | Pending isolated target + local app |
| E2E collection | `playwright test --list phase-06-inventory` | Passed: 17 tests in 1 file |
| 10k / 100k benchmark | `pnpm inventory:benchmark` | Pending isolated target + local app |

Local Vitest needs approved local execution because esbuild cannot traverse a
desktop parent directory inside the default sandbox; this does not disable or
omit tests. The pending target-dependent gates remain release blockers.
