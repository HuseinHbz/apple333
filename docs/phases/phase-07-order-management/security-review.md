# Phase 07 Security Review

## Decision

**Local security/runtime controls pass; candidate-commit CI and artifact review
are still required. Current decision: DO NOT APPROVE PHASE 07.**

No production environment, credential, shared database, deployment, or runtime
secret was accessed. The final production dependency audit reported zero Info,
Low, Moderate, High, or Critical findings.

## Control evidence

| Area                      | Implemented control                                                                                     | Local evidence                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Customer ownership / IDOR | Repository query is scoped by authenticated customer ID and service/route require own-order permission. | PostgreSQL query-scope, API, and browser denial tests pass.         |
| Admin and branch scope    | Route and service enforce order permissions and target branch scope before writes.                      | Unit, integration, and no-side-effect PostgreSQL tests pass.        |
| Field confidentiality     | DTO mapping independently gates finance, customer PII, and IMEI/serial fields.                          | Projection tests and browser privacy checks pass.                   |
| Pricing integrity         | Strict inputs exclude authoritative totals; server derives integer IRR snapshots.                       | Unit, integration, DB, and browser creation tests pass.             |
| Lifecycle integrity       | Domain service owns transitions, version checks, history, audit, and outbox.                            | Unit, integration, and PostgreSQL persistence tests pass.           |
| Idempotency               | Create and sensitive mutations use durable scoped key/request hashes.                                   | Replay, reconnect, and concurrency tests pass.                      |
| Inventory races           | Serializable reservations and active device-assignment uniqueness prevent oversell/reuse.               | Final-stock and IMEI PostgreSQL concurrency tests pass.             |
| Request security          | Same-origin mutation checks, rate limiting, correlation IDs, strict Zod schemas, and safe envelopes.    | Route and E2E denial tests pass.                                    |
| Audit and outbox          | Redacted audit context and transactional outbox are written with aggregate changes.                     | Persistence and rejected-transition tests pass.                     |
| Payment boundary          | Only payment metadata is stored; no PAN, CVV, or card token field exists.                               | Static schema/API review passes; settlement remains Phase 08 scope. |
| Test safety               | Host/name/marker/ownership guards fail closed; Windows server-reuse marker is internal only.            | 11 guard tests and disposable runtime execution pass.               |
| Dependencies              | Patched PostCSS, brace-expansion, fast-uri, and nanoid resolutions.                                     | `pnpm audit --prod --json`: zero findings.                          |

## Security invariants

1. An order number is never authorization; customer ownership is enforced in
   the database query as well as service and route layers.
2. Persisted totals come only from server-side commercial snapshots.
3. A tracked device cannot have two active order assignments.
4. Sensitive fields are omitted/null in DTO construction, not merely hidden in
   the UI.
5. Sensitive mutations require permission, idempotency, optimistic versioning,
   audit, and outbox evidence.
6. Phase 07 stores no cardholder data and performs no gateway settlement.
7. Runtime tooling rejects production-like targets before database access.

## Remaining approval blockers

| Item                 | Required evidence                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Exact candidate CI   | All Phase 07 GitHub Actions jobs green for the candidate commit.                                 |
| Same-commit 100k run | Explicit workflow dispatch with the 100k benchmark enabled.                                      |
| Security automation  | Candidate Gitleaks/CodeQL/dependency evidence green where configured.                            |
| Artifact review      | Human review confirms retained logs/reports contain no secrets, PII, or full device identifiers. |

No numerical score can override one of these mandatory gates.
