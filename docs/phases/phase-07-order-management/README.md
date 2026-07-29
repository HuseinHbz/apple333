# Phase 07 — Order Management System

## Status

Implementation is in progress. This document is intentionally kept factual: an
item is marked as delivered only after its dedicated test and runtime evidence
are available.

## Repository baseline

The requested baseline branch was named `main`, but this repository uses
`master` and the approved Phase 06 capabilities have not been flattened into
that branch. The Phase 07 branch was therefore created from the approved
`feature/phase-06.1.1-inventory-production-approval-closure` head. This keeps
the Inventory, PIM, cart, RBAC, audit, and CI prerequisites available without
rewriting history or merging unrelated local worktree changes.

## Scope

Phase 07 establishes the transactional order aggregate used by storefront,
admin-assisted, and branch-compatible sales. It includes immutable commercial
snapshots, server-side totals, inventory reservations and allocations, order
state transitions, idempotency, audit records, an outbox, administrative order
operations, customer order views, and disposable runtime evidence.

Payment gateway settlement, courier integrations, accounting postings,
installment processing, and advanced returns remain explicitly out of scope.

## Existing integration points

- Storefront cart and quote: `src/server/services/storefront-cart-service.ts`
- Guest cart identity: `src/server/storefront/guest-cart.ts`
- Inventory reservations: `src/server/services/inventory-service.ts`
- Serializable inventory repository operations:
  `src/server/repositories/inventory-repository.ts`
- Administration route envelope and CSRF/rate-limit controls:
  `src/server/admin/route.ts`
- Storefront route envelope and controls: `src/server/storefront/route.ts`
- Session and RBAC actor resolution: `src/modules/auth/session.ts` and
  `src/server/security/permissions.ts`
- Existing audit trail: `src/server/repositories/audit-log-repository.ts`

## Architectural boundaries

1. The Order aggregate is the only authority for order status and commercial
   snapshot persistence. Route handlers and UI never write order statuses
   directly.
2. Catalog prices are read and calculated only on the server. All persisted
   monetary values are integer IRR minor units (`BigInt`), never JavaScript
   floating-point values.
3. Inventory remains the source of truth for physical availability. Orders use
   its transactional reservation rules and retain a one-to-one auditable link
   from each allocation to its reservation.
4. Every state-changing command is actor-scoped, idempotent, optimistic-lock
   protected, audited, and emits a transactional outbox event.
5. Public projections never expose internal notes, operational metadata, full
   IMEIs, payment provider internals, or a different customer's orders.

## Delivery sequence

1. Repository and integration audit
2. Domain, state machine, contracts, and migration review
3. Additive Prisma migration and transactional services
4. Storefront and admin API/UI integration
5. Disposable database, E2E, reconciliation, benchmark, and CI evidence
6. Final review and approval report

See the sibling documents for the current design contracts and evidence.
