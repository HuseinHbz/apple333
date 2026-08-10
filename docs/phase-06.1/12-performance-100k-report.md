# Phase 06.1 - 100k Inventory Performance Report

**Runtime status:** **EXECUTED / PASS**
**Target:** critical-read p95 `< 250 ms`
**Production resources touched:** No.

## Isolated 100k result

The benchmark ran on a second fresh disposable database, distinct from the
10k dataset. Synthetic fixture creation completed in `61069.041 ms`; the
critical query plans used index scans.

| Measurement                | p95 (ms) |
| -------------------------- | -------: |
| SKU inventory lookup       |    0.859 |
| Branch lookup              |    0.925 |
| Public availability lookup |    2.038 |
| API request                |   10.205 |

All recorded p95 values are below the 250 ms target. The measured values are
reported exactly as captured; this report does not infer p50/p99, throughput,
or host-resource figures that were not supplied by the recorded result.

## Reconciliation and fixture-isolation scope

The 100k benchmark used a separate fresh disposable database. It did not cause
or resolve the later `BranchInventory` reconciliation drift found after a
database-suite-plus-E2E sequence. That run reported `canonical=21`,
`projection=21`, `drift=2` because a database-test fixture directly created a
three-unit `DAMAGED` `InventoryItem` without a service projection update. The
independent fresh E2E re-run then passed reconciliation with `canonical=12`,
`projection=12`, `drift=0`.

Therefore this benchmark is performance evidence only; it is not evidence that
the physical-versus-sellable `BranchInventory` semantic contract or fixture
isolation gap has been resolved.

## Boundary

The result is controlled local performance evidence only. It does not certify
production load, concurrency capacity, regional network latency, monitoring,
backup, or failover behaviour. The separate benchmark environment was removed
through label-verified cleanup after collection.

## Decision

The 100k performance acceptance target passed for the recorded isolated run.
