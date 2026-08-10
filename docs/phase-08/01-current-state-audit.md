# Phase 08 Current-State Audit

## Approved baseline

Phase 08 starts from `3a197d5` on
`feature/phase-08-payment-financial-orchestration`. Phase 07 implementation
commit `fe412ea` is approved at 9.8/10 with exact-commit Quality, Security,
PostgreSQL, E2E, 10k, 100k, reconciliation, and artifact evidence. Phase 06 is
approved as the inventory capability integrated in that same secure baseline.

No production database, credential, gateway, deployment, or shared runtime was
accessed during this audit.

## Existing payment-related implementation

| Area | Existing behavior | Phase 08 decision |
| --- | --- | --- |
| `Order.paymentStatus` | OMS projection using `OrderPaymentStatus`. | Keep as an order-owned summary; update only after canonical Payment verification. |
| `OrderPayment` | Phase 07 legacy metadata/placeholder table. | Preserve additively for historical compatibility; do not use as the Phase 08 aggregate. |
| Order creation | Writes an `UNPAID`, `PHASE_08_PENDING` placeholder. | Stop creating new placeholders after Payment activation; do not rewrite old rows. |
| Admin payment route | `/api/admin/orders/[id]/payment` can record `PAID` manually. | Retire the mutation from operational use; verified Payment service becomes the only PAID authority. |
| Checkout | Creates an order and reaches an order-success shell. | Add canonical payment creation, initialization, simulator redirect, and return state. |
| Order outbox | Atomic order events exist. | Keep order outbox ownership; add a separate Payment outbox and atomically emit `order.payment_completed` after verification. |
| Idempotency | Durable OMS command records exist. | Add Payment-scoped durable idempotency records; do not reuse OMS scopes. |
| Audit | Generic `AuditLog` and order history exist. | Reuse redacted audit logging with Payment entity identifiers only. |
| Security | Same-origin checks, bounded rate limiting, request IDs, Zod, safe envelopes, RBAC. | Reuse and strengthen for hostile callbacks, signature validation, replay prevention, and timeout/retry bounds. |
| Redis | Health-checked cache abstraction exists. | Use only for non-authoritative transient controls; financial idempotency remains PostgreSQL-backed. |

## Reusable components and patterns

- Next.js App Router route handlers and server components.
- `withAdminRoute`, `runStoreRoute`, request correlation, no-store responses,
  same-origin mutation checks, and safe error envelopes.
- `SessionActor`, permission guards, role seeding, branch scoping, and admin UI
  primitives.
- Prisma service/repository separation and serializable transaction retry
  pattern from the OMS.
- `AuditLog`, Prometheus registry, structured safe logging, and transactional
  order outbox.
- Order/customer projections and the approved order detail/account routes.
- Guarded disposable PostgreSQL/Redis test-environment tooling and sanitized
  Playwright evidence.

## Technical debt relevant to Phase 08

1. `OrderPayment` combines a placeholder and manual evidence concept but is not
   a provider orchestration aggregate.
2. The legacy admin route can mark an order paid without provider verification.
3. Payment permissions are currently folded into order/finance permissions.
4. The in-process rate limiter is defense-in-depth, not a distributed callback
   replay control.
5. Existing metrics cover orders but not payment lifecycle latency or failure
   classes.
6. Pinned GitHub actions emit a Node 20-to-24 compatibility warning; it is
   non-blocking but should be maintained independently.

## Production gaps closed by this phase

- canonical Payment state machine and immutable financial interaction records;
- provider-neutral port and deterministic external simulator;
- server-authoritative amount and currency verification;
- callback signature, replay, authority, and duplicate-success protection;
- durable idempotency across restarts and concurrent requests;
- verified order-payment integration and transactional outbox evidence;
- controlled refund foundation and read-only reconciliation;
- customer/admin payment surfaces, RBAC, observability, DB/E2E/performance CI.

## Files expected to change

- `prisma/schema.prisma` and one new additive migration;
- `src/modules/payments/**`, `src/server/repositories/payment-repository.ts`,
  `src/server/services/payment-service.ts`, and payment provider adapters;
- payment storefront/provider/admin route handlers and payment UI components;
- RBAC, metrics, readiness, order integration, package scripts, test config,
  guarded environment/compose/scripts, CI workflow, deployment documentation;
- unit, integration, database, and E2E tests plus the remaining Phase 08 docs.

## Audit risks

| Risk | Control |
| --- | --- |
| Double payment or duplicate callback | PostgreSQL uniqueness, row locking, optimistic version, durable request hashes. |
| Browser amount tampering | Amount/currency absent from create/init inputs; persisted Order snapshot is authoritative. |
| Provider false success | Server-to-server verification and exact amount/currency/reference match required. |
| Cross-customer/branch data exposure | Ownership query and dedicated payment permission projections. |
| Legacy manual PAID path | Deprecate route and remove UI access; regression test that it cannot complete payment. |
| Migration damage | Additive-only SQL, reviewed before apply, disposable PostgreSQL first. |
| Secret/card leakage | HMAC secret only in environment, payload hashes only, prohibited-field artifact scan. |
