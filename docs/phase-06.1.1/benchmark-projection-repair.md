# Phase 06.1.1 — Retained Benchmark Projection Repair

`scripts/backfill-benchmark-branch-inventory.mjs` exists only for an isolated
Phase 06 test database that retained benchmark data created before the
sellable-stock projection fix. It is not a production migration, does not use
production credentials, and is not invoked by deployment tooling.

The default invocation is read-only:

```text
node scripts/backfill-benchmark-branch-inventory.mjs --run-id <benchmark-run-id>
```

Applying the repair requires both `--apply` and
`INVENTORY_BENCHMARK_BACKFILL_ACKNOWLEDGED=1`. It uses the same loopback-only
test-environment guard as the database tests. The repair may only create an
absent `BranchInventory` projection from the canonical sellable physical
aggregate. It never deletes data, changes `InventoryItem`, or overwrites an
existing projection; an existing mismatch fails closed for manual review.

This local repair is separate from the normal reconciliation command, which
remains read-only. New benchmark runs no longer need repair because
`scripts/benchmark-inventory.mjs` now creates each projection in the same
transaction as its physical stock.
