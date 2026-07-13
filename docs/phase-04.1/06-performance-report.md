# Phase 04.1 — PIM performance report

## Final status

**Pass on the guarded disposable CI target.** The final source commit
`b82bef573928393ab79354102b6d196cdd33c280` ran the 10,000- and
100,000-product benchmark in [workflow run 29238326931](https://github.com/HuseinHbz/apple333/actions/runs/29238326931),
job `86778151181`. The workflow uploaded the evidence artifact
`phase-04-1-pim-performance-29238326931` (artifact `8274411940`, SHA-256
`20ecb5dbbb97211defdcb5e2eeebfef37686184040c2069eb785104c3962780e`).

The benchmark used GitHub-hosted `ubuntu-latest`, PostgreSQL 16.6, one guarded
`apple333_pim_test` database, and run marker `ci-29238326931`. It never used a
shared, development, or production database.

## Enforced thresholds

| Gate                                                      |                         Threshold | Result              |
| --------------------------------------------------------- | --------------------------------: | ------------------- |
| Public HTTP endpoint p95                                  |                        <= 3,000ms | Pass at both scales |
| `EXPLAIN (ANALYZE, BUFFERS)` execution p95 per query path |                          <= 250ms | Pass at both scales |
| HTTP status                                               | All 5 samples per path return 200 | Pass at both scales |

The harness refreshes planner statistics for its guarded fixture tables and
serializes plan measurements. This prevents concurrent benchmark queries from
being misreported as one request's latency.

## Final measurements

| Scale            |                            Seed added | SQL p95: listing / category listing / detail | SQL p95: SKU / workflow | HTTP p95: listing / category listing / detail / categories |
| ---------------- | ------------------------------------: | -------------------------------------------- | ----------------------- | ---------------------------------------------------------- |
| 10,000 products  |                           2,669.681ms | 16.271 / 15.727 / 0.156ms                    | 0.055 / 0.050ms         | 94.875 / 26.302 / 18.161 / 4.729ms                         |
| 100,000 products | 20,972.043ms additional (90,000 rows) | 59.887 / 47.034 / 0.138ms                    | 0.068 / 0.066ms         | 117.225 / 105.905 / 12.979 / 4.392ms                       |

Every path used five samples. All captured shared-read block counts were zero
after fixture seeding and planner-statistics refresh.

## Query-plan and index review

| Path                                         | Final 100k plan evidence                                                                      | Review |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| Public listing and category-filtered listing | `CatalogVariant_productId_optionKey_idx`, `ProductSku_variantId_key`; p95 59.887ms / 47.034ms | Pass.  |
| Product detail                               | `CatalogProduct_slug_key`, variant and SKU indexes; p95 0.138ms                               | Pass.  |
| Import SKU validation                        | `ProductSku_code_key`; p95 0.068ms                                                            | Pass.  |
| Workflow history                             | ordered two-event fixture; p95 0.066ms                                                        | Pass.  |
| Category list                                | single active fixture category; p95 0.066ms                                                   | Pass.  |

At 10k rows PostgreSQL selected sequential access for the broad listing paths
because the test fixture is deliberately highly non-selective; their p95 values
remained below 17ms. This is recorded rather than treated as an unsupported
index claim. The 100k results and hard query gate are the relevant release
evidence.

## Remaining performance risks

- `searchText` has no dedicated full-text or trigram index; scalable free-text
  search remains out of scope until a separate search strategy is approved.
- Import apply remains bounded to 500 rows. The SKU conflict path is measured,
  but a high-volume update/upsert import contract is intentionally not present.
- A legacy-database migration would require separate lock-window and
  concurrent-index planning; this benchmark covers only the pristine baseline.

An earlier benchmark run was not used for approval because its independent
`EXPLAIN` paths ran concurrently and introduced resource contention. The final
run above uses serialized measurements and the automated p95 quality gates.
