# Phase 08 Test Report

## Evidence scope

All database and browser evidence uses the guarded Phase 08 environment:

- PostgreSQL `apple333_phase08_payment_test` on loopback port `55435`;
- Redis DB 8 on loopback port `56380`;
- deterministic payment simulator health endpoint on loopback port `58080`;
- `APPLE333_TEST_DB=1`, `APPLE333_PAYMENT_TEST_DB=1`, and the additional E2E
  marker only for production-artifact browser execution.

The preflight rejects non-test database names, non-loopback database hosts,
production gateway hosts, missing disposable markers, and production gateway
credential patterns.

## Coverage

| Layer                  | Evidence                                                                                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                   | Status transitions, Zod money/input constraints, request hashing and idempotency conflicts, provider mappings, callback HMAC validation, retryable errors, refund outcomes, RBAC, reconciliation rules, and environment guards     |
| API integration        | Browser amount rejection, same-origin mutation enforcement, admin permission boundary, refund validation, and provider callback contract                                                                                           |
| PostgreSQL persistence | Order-owned amount, create/init/verify lifecycle, atomic Order paid projection/outbox, amount-mismatch fail-closed, immutable transactions, check constraints, refund bounds, and reconciliation                                   |
| PostgreSQL concurrency | One idempotency winner, one callback winner, one optimistic-version winner, serialized refund bound, restart-persistent initialization, single refund finalization, and atomic reconciliation replay                               |
| Playwright             | Customer payment navigation, declined/retry, cancelled retry, server-verified success, duplicate callback, invalid signature, paid Order projection, ownership denial, finance detail/reconciliation, and refund permission denial |

## Latest local results

The final local gate run produced:

- locked dependency installation: passed;
- Prisma validation/generation and additive disposable migration: passed;
- TypeScript, Phase 08 test TypeScript, and ESLint: passed;
- application suite: 74 files / 387 tests;
- dedicated integration suite: 11 files / 79 tests;
- payment database suite: 2 files / 12 tests;
- payment E2E suite: 10 scenarios;
- Phase 07 Order database regression: 2 files / 15 tests;
- Phase 07 Order production-artifact E2E regression: 8 scenarios;
- Phase 06 Inventory production-artifact E2E regression: 22 scenarios;
- production build: passed;
- Prisma migration application and repeated no-op invocation: passed; and
- production dependency audit: no known vulnerabilities.

The initial database concurrency run exposed unhandled raw-query SQLSTATE
`40001`; the retry classifier was corrected and the complete database suite was
rerun successfully. Two E2E failures exposed a corrupted locator and a missing
wait for asynchronous server verification; both test defects were corrected
without weakening application assertions, and all 10 journeys then passed.

## GitHub remediation evidence

The first GitHub runs were not hidden or marked non-blocking:

- Gitleaks reported two deterministic test fixtures. Exact historical
  fingerprints were recorded in `.gitleaksignore`; the final push and PR
  history scans passed.
- Dependency Review initially reported that Dependency Graph was disabled.
  The graph and alerts were enabled through the official GitHub repository
  endpoint, the compare endpoint returned `200`, and the rerun plus final head
  run passed.
- The Phase 07 database regression exposed removal of its unpaid compatibility
  projection. The projection was restored without making it authoritative for
  gateway state, and all 15 database tests passed locally and in GitHub.
- Legacy Order E2E expected the now-disabled manual paid mutation to succeed.
  It now proves the required `410` fail-closed response while the dedicated
  Phase 08 suite proves canonical payment completion.
- Inventory E2E expected a no-permission login to remain on the protected page.
  It now asserts the authorization redirect while retaining API-level `403`
  evidence. The unbound Branch Manager remains page-authenticated but all
  branch-dependent APIs fail closed.

The final GitHub evidence head passed Payment, Quality, Security, Order, and
Inventory workflows without failed or pending checks.

## Integrity assertions

- Browser-supplied monetary values are rejected at the API boundary.
- Provider amount/currency mismatch cannot mark Payment or Order paid.
- Callback duplication and concurrent unique-key races have one canonical
  database winner.
- `PaymentTransaction` rejects update and delete at the database layer.
- Total pending/succeeded refund reservation is serialized with row locking and
  cannot exceed captured value.
- Simulator success is accepted only after server verification.
- Normal production runtime rejects `PAYMENT_SIMULATOR`.
