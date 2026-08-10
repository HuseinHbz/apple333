# Phase 06.1 - RBAC Runtime Validation Report

**Branch:** `feature/phase-06.1-inventory-runtime-evidence`
**Runtime status:** **PARTIALLY EXECUTED**
**Production resources touched:** No.

## Executed evidence

The final production-mode Playwright run passed all **17 / 17** inventory
scenarios against the seeded disposable PostgreSQL/Redis runtime. The real
PostgreSQL suite also passed **2 files / 13 tests**, including branch-scope
denial and audit-redaction assertions.

| Control                                                               | Evidence result                                                            |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Unauthenticated admin inventory, branch, warehouse, and device routes | Redirected to login in the browser suite                                   |
| Seeded inventory manager access                                       | Passed protected dashboard, branch, warehouse, and inventory API scenarios |
| Protected stock mutations                                             | Receipt, adjustment, transfer, reservation, and release scenarios passed   |
| Cross-branch mutation denial                                          | Passed in the real PostgreSQL persistence suite                            |
| Public IMEI disclosure                                                | Public storefront scenario confirmed the raw IMEI is absent                |
| Protected-device presentation/API                                     | Browser scenarios confirmed masked rather than raw IMEI output             |
| Privileged mutation audit/redaction                                   | Passed in the PostgreSQL suite                                             |

## Remaining actor-matrix gaps

The final passing browser suite does **not** independently execute every
requested actor profile. The following are not claimed as complete runtime
coverage: Super Admin, separate Branch A and Branch B manager journeys,
inventory read-only, IMEI-read-only, and a user with no inventory permission.
Likewise, the suite is not a complete HTTP 401/403 matrix for every endpoint.

These gaps prevent this report from being treated as complete enterprise RBAC
certification even though the exercised authentication, branch-scope, masking,
and mutation paths passed.

## Decision

The exercised RBAC/security paths passed on the disposable runtime. Full actor
matrix coverage remains an approval gap and must be added or formally scoped
before a later release decision.
