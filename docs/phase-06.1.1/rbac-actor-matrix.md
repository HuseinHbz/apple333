# Phase 06.1.1 — Inventory RBAC Actor Matrix

**Scope:** isolated local Phase 06 test data only. The evidence contains no
production account, credential, or customer data.

## Authorization model

Inventory access requires both an explicit permission and a resolved branch
scope. `SUPER_ADMIN`, `ADMIN`, and `INVENTORY_MANAGER` are global inventory
roles. `BRANCH_MANAGER` and `WAREHOUSE_STAFF` are branch-scoped and fail
closed when the administrative user has no assigned branch. A role without an
inventory permission cannot gain access solely from a branch assignment.

| Actor | Read | Receive / adjust / transfer / reserve / release | Branch scope | Evidence |
| --- | --- | --- | --- | --- |
| `SUPER_ADMIN` | Allowed | Allowed | All branches | Browser/API cross-branch read |
| `INVENTORY_MANAGER` | Allowed | Allowed | All branches | Browser/API operational journeys |
| `BRANCH_MANAGER` | Allowed | Allowed | Assigned branch only | Own-branch receipt succeeds; cross-branch receipt returns `403` |
| `READ_ONLY_USER` | Allowed | Denied | Read-only visibility | Read is `200`; mutation returns `403` |
| `NO_PERMISSION_USER` | Denied | Denied | None | Read and mutation both return `403` |
| Unbound `BRANCH_MANAGER` | Denied | Denied | None; fail closed | Inventory read returns `403` |

## Controls verified

- The service layer, rather than only the UI, resolves and enforces branch
  scope for inventory operations.
- Global inventory configuration is rejected for a branch-scoped actor.
- Cross-branch access is rejected before a stock mutation is committed.
- Inventory mutation code continues to create its existing audit records.
- Public and protected device responses expose a masked IMEI representation;
  the raw IMEI is absent from the storefront and authenticated envelope.

## Automated proof

`tests/unit/inventory-rbac.test.ts`,
`tests/integration/inventory-api.test.ts`, and
`tests/e2e/phase-06-inventory.spec.ts` cover the actor matrix. The Playwright
suite is seeded with explicit isolated identities and verifies all rows above
through browser-originated API requests. The closure CI workflow uploads the
corresponding test results and Playwright traces/screenshots on failure.
