# Phase 06.1 - Dataset Seed Report

**Branch:** `feature/phase-06.1-inventory-runtime-evidence`
**Seed status:** **EXECUTED / PASS**
**Production resources touched:** No.

## Small deterministic fixture

`pnpm inventory:e2e:seed` was executed twice against the migrated disposable
database. Both invocations completed successfully, demonstrating the intended
upsert/idempotency behaviour for the controlled fixture.

| Fixture dimension  | Verified result                                                                        |
| ------------------ | -------------------------------------------------------------------------------------- |
| Branches           | 4                                                                                      |
| Warehouses         | 5, including the disabled test warehouse                                               |
| SKU tracking modes | 3: normal, serial, and IMEI                                                            |
| Device units       | 7                                                                                      |
| State coverage     | Available, reserved, damaged, transferred, active, and disabled fixture states present |
| Roles/scopes       | Global inventory manager plus branch-scoped manager fixtures created                   |
| Repeat seed        | Second invocation passed without duplicate-key failure                                 |

### Earlier invalid attempts and remediation

Earlier local attempts exposed an invalid damaged-balance fixture and fixture
identifier collisions with the database test suite. Those failures were not
treated as passing evidence. The fixture balances and isolated identifiers
were corrected, then the final clean run seeded twice successfully.

## Benchmark datasets

The benchmark harness used separate fresh disposable databases for the 10k and
100k datasets. The datasets were synthetic, test-only, and not derived from
customer, order, serial, IMEI, or production inventory data. Detailed measured
results are recorded in [11-performance-10k-report.md](11-performance-10k-report.md)
and [12-performance-100k-report.md](12-performance-100k-report.md).

## Decision

The small fixture and both benchmark fixture paths were executed only on the
labelled disposable environment. The data was removed with the owned test
resources after evidence collection.
