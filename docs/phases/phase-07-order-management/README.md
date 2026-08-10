# Phase 07 - Order Management System

## Status

**Local implementation candidate is complete. Final approval remains blocked
until the exact candidate commit has green GitHub Actions evidence and retained
artifacts are reviewed.**

No production database, credential, deployment, or shared runtime was accessed.
All database, browser, reconciliation, and benchmark evidence recorded here was
created against the label-owned disposable Phase 07 PostgreSQL environment.

## Repository baseline

The repository default branch is `master`, not `main`. This work is isolated on
`feature/phase-07-order-management`, created from the approved Phase 06.1.1
candidate without rewriting history. Unrelated local deployment, Phase 02, and
shared-infrastructure changes remain outside the Phase 07 candidate scope.

## Delivered scope

Phase 07 provides the transactional Order aggregate for authenticated
storefront customers, admin-assisted sales, and branch-scoped operations. It
includes:

- immutable commercial, customer, and address snapshots;
- server-authoritative integer IRR pricing;
- inventory reservation, allocation, release, consumption, and durable tracked
  device assignment evidence;
- explicit order, payment-metadata, and fulfillment state transitions;
- optimistic concurrency, durable idempotency, audit history, and transactional
  outbox events;
- ownership-, branch-, and permission-scoped APIs and projections;
- storefront and admin order surfaces;
- additive-only Prisma migration and guarded disposable PostgreSQL tooling;
- database/concurrency, E2E/Axe, reconciliation, and 10k/100k benchmark evidence.

Payment-gateway settlement, refunds, courier integration, accounting,
installment processing, advanced returns, a production outbox publisher, and a
production expiry scheduler are out of scope.

## Core boundaries

1. The Order aggregate is the only authority for lifecycle and commercial
   snapshot persistence.
2. Browser-provided totals are never trusted; money is stored as integer IRR
   values and never calculated with JavaScript floating point.
3. Inventory remains the source of truth for physical availability.
4. Sensitive commands are actor-scoped, idempotent, version-protected, audited,
   and coupled atomically to outbox evidence.
5. Customer projections omit internal notes, allocation internals, complete
   IMEIs/serials, and provider references. Administrative finance, PII, and
   device fields have separate permissions.
6. `OrderDeviceAssignment` preserves device history after release or
   fulfillment.

## Evidence summary

- Unit: 64 files / 344 tests passed.
- Integration: 10 files / 73 tests passed.
- Real PostgreSQL: 2 files / 15 tests passed.
- Standalone Playwright/Axe: 8 / 8 scenarios passed.
- Reconciliation: 120,146 orders checked, zero drift.
- 10k and 100k PostgreSQL benchmark gates passed well below their p95 targets.
- Production dependency audit: zero findings at every severity.
- Type checks, lint, Prisma validation/generation, and production build passed.

The exact numbers and evidence boundaries are in `runtime-evidence.md`. The
phase remains **DO NOT APPROVE** until the same candidate commit passes GitHub
Actions, including the explicitly dispatched 100k job, and artifact review.
