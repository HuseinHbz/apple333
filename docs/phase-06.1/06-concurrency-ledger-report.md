# Phase 06.1 - Concurrency and Ledger Consistency Report

**Branch:** `feature/phase-06.1-inventory-runtime-evidence`
**Runtime status:** **EXECUTED / PASS**
**Production resources touched:** No.

## Real PostgreSQL concurrency evidence

The final guarded inventory database run completed with **2 files / 13 tests
passed**. Its concurrency file exercised the real transactional service and
PostgreSQL rather than mocks.

| Concurrent scenario        | Final result                                                                   |
| -------------------------- | ------------------------------------------------------------------------------ |
| Last-unit reservation race | Passed: one operation succeeds and the competing operation is safely rejected  |
| Same-IMEI receipt race     | Passed: one device record remains and the competing operation is rejected      |
| Same-device transfer race  | Passed: exactly one transfer succeeds and final device ownership is consistent |
| Parallel adjustment race   | Passed: successful deltas are retained with consistent balance/ledger state    |

## Earlier failed attempt and correction

An earlier concurrency run reused an IMEI also used by the persistence suite.
That measured a pre-existing unique-key collision rather than the intended
race. The concurrency fixture was changed to derive an isolated Luhn-valid
IMEI per run, and test-file execution was made sequential while retaining the
actual `Promise.allSettled` races inside each scenario. The final result above
is the clean post-fix run.

## Ledger and reconciliation boundary

The final database suite passed without timeout, deadlock, or leaked partial
write. Read-only reconciliation recorded zero drift before and after the
browser mutation sequence; see
[07-compatibility-reconciliation-report.md](07-compatibility-reconciliation-report.md).

## Decision

The required concurrency/ledger gate passed on the disposable PostgreSQL
target. It is not a substitute for production load testing.
