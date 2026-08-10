# Phase 08 payment deployment boundary

Phase 08 adds an additive payment schema and application surfaces, but it does
**not** authorize production payment processing or database migration. The only
provider in this phase is `PAYMENT_SIMULATOR`; application services reject it in
a normal `NODE_ENV=production` runtime. Its narrowly guarded production build
mode exists only for the loopback, labelled Phase 08 E2E database.

## Production release status

- Real gateway selection, credentials, commercial approval, and callback
  allow-listing are deferred.
- `PAYMENT_PROVIDER_TIMEOUT_MS` is bounded by the application to a maximum of
  30 seconds; the default is 10 seconds and provider operations receive no more
  than two idempotent attempts.
- `20260810000000_phase_08_payment_orchestration` is validated only on the
  disposable Phase 08 PostgreSQL target.
- Existing deployment migration gates remain in force. Do not run
  `prisma migrate deploy`, `prisma db push`, or manual SQL for this phase on a
  production, shared, or unknown database.
- A code-only deployment must leave payment initialization unavailable. It is
  not a substitute for a real-provider release.

## Future production activation checklist

Before activation, a separately reviewed release must:

1. name the selected provider and legal/commercial owner;
2. implement and audit a production adapter without changing the domain port;
3. provision secrets outside Git and prove callback signature validation,
   source/edge controls, timeouts, and bounded retries;
4. inspect database identity and Apple333 ownership before migration;
5. review additive SQL, lock impact, backup, restore rehearsal, and rollback;
6. run all Phase 08 CI evidence with the production adapter's official sandbox;
7. verify zero High/Critical production findings and zero unexplained
   reconciliation drift; and
8. explicitly approve the exact migration and target class in
   `deploy/RELEASE-GATES.md` and the release record.

## Runtime and monitoring impact

The application exposes payment lifecycle, callback, amount-mismatch,
reconciliation, refund, and verification-duration Prometheus metrics through
the existing private metrics endpoint. Logs contain correlation identifiers
and canonical result codes only. Card numbers, CVV, gateway secrets, access
tokens, and raw sensitive callback bodies are prohibited.

Refund support is orchestration-only: there is no accounting posting, bank
settlement accounting, installment refund logic, or general ledger in Phase 08. Application rollback must leave append-only financial evidence intact.

## Disposable local evidence

`docker-compose.payment-test.yml` is not a deployment compose file. It binds
PostgreSQL, Redis, and the simulator health service to loopback-only high ports,
labels every resource as Phase 08 disposable, and is protected by the payment
test preflight. Cleanup may target only those exact labelled resources.
