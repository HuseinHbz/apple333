# Phase 06.1 - PostgreSQL Persistence Report

**Branch:** `feature/phase-06.1-inventory-runtime-evidence`
**Runtime status:** **EXECUTED / PASS**
**Production resources touched:** No.

## Real PostgreSQL result

The guarded database wrapper ran against the migrated loopback-only test
database. It revalidated the target identity and migration state before
loading the real inventory service and Prisma client.

```text
Vitest inventory database suite: 2 files passed / 13 tests passed
```

The final clean run had no skipped or hidden failing database test.

## Verified persistence behaviour

The passing suite exercised the real PostgreSQL implementation for:

- branch, warehouse, and location ownership;
- normal and IMEI-tracked receipts;
- unique-IMEI conflict and rollback behaviour;
- tracked-device transfer and exact-unit reservation/release;
- bulk adjustment and negative-balance protection;
- database balance checks and branch-scope denial;
- inactive-location reservation rejection;
- audit redaction; and
- privacy-safe public availability output.

The separate concurrency scenarios are documented in
[06-concurrency-ledger-report.md](06-concurrency-ledger-report.md).

## Boundary

This result proves the tested behaviour on the disposable Phase 06.1 target.
It does not authorize production database writes or migrations.

## Decision

The persistence gate passed for the final clean isolated run.
