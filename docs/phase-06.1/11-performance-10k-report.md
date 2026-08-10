# Phase 06.1 - 10k Inventory Performance Report

**Runtime status:** **EXECUTED / PASS**
**Target:** critical-read p95 `< 250 ms`
**Production resources touched:** No.

## Isolated 10k result

The benchmark ran on a separate fresh disposable database and a local
production-mode application. Synthetic fixture creation completed in
`6158.132 ms`; the critical query plans used index scans.

| Measurement                | p95 (ms) |
| -------------------------- | -------: |
| SKU inventory lookup       |    1.109 |
| Branch lookup              |    0.828 |
| Public availability lookup |    1.989 |
| API request                |   11.281 |

All recorded p95 values are below the 250 ms target. The emitted benchmark
plan review reported index scans for the critical reads.

## Boundary

This is a controlled single-host isolated benchmark, not a production load,
throughput, failover, CPU/memory, connection-pool, or external-network claim.
The benchmark resource was removed with its label-verified disposable
environment after evidence collection.

## Decision

The 10k performance acceptance target passed for the recorded isolated run.
