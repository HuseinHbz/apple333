# Phase 06 — Performance Report

## Target and evidence state

The release target is **p95 < 250 ms** at both 10,000 and 100,000 canonical
SKUs across four branches, for SKU lookup, branch stock lookup, canonical
availability query, and public availability API latency.

No performance number is claimed in this repository session. There is no
approved isolated PostgreSQL target or local application attached to that
target. The benchmark never falls back to development, staging, shared, or
production data.

## Guarded harness

`scripts/benchmark-inventory.mjs` runs only when all of these are true:

- `NODE_ENV=test` and `APPLE333_INVENTORY_TEST_DB=1`;
- the PostgreSQL URL is loopback-only with the exact dedicated identity
  `apple333_inventory_test` / `apple333_inventory_test` / port `55433`;
- `INVENTORY_BENCHMARK_ALLOW_SEED=1` and a new safe run ID are supplied;
- API base is exactly `http://127.0.0.1:3000`; and
- the Phase 06 migration has already completed on the target.

The harness never creates a database, runs a migration, deletes rows, alters a
previous run, or uses an unknown target. It writes retained marked fixtures
only after preflight; a reused or partial run ID fails instead of repairing or
cleaning data.

The script creates one marked PIM product with the requested number of
canonical `ProductSku` records and four `InventoryItem` balances per SKU. It
runs at least 30 warmed samples, reports p50/p95/p99, captures
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` for each SQL path, and fails when a
p95 exceeds the configured 250 ms target.

## Operator runbook

1. Copy `.env.inventory-test.example` to `.env.inventory-test`, replace the
   sample local password in both matching values, and keep the copy untracked.
2. Start only the isolated database explicitly:

```powershell
docker compose --env-file .env.inventory-test -f docker-compose.inventory-test.yml up -d
```

   This Compose project uses only `127.0.0.1:55433`, its own role, database,
   network, and volume. It is never included by production Compose files.
3. Export the exact test environment below and run
   `pnpm inventory:test:migrate`; it refuses a non-pristine target.
4. Start Next.js locally with `DATABASE_URL` exactly equal to
   `INVENTORY_TEST_DATABASE_URL` and no production secrets.
5. Choose a new run ID and run each scale separately.
6. Attach JSON and query-plan output to this report; do not substitute shared
   environment evidence.

```powershell
$env:NODE_ENV = 'test'
$env:APPLE333_INVENTORY_TEST_DB = '1'
$env:INVENTORY_TEST_DATABASE_URL = 'postgresql://apple333_inventory_test:<password>@127.0.0.1:55433/apple333_inventory_test?schema=public'
$env:INVENTORY_BENCHMARK_ALLOW_SEED = '1'
$env:INVENTORY_BENCHMARK_API_BASE_URL = 'http://127.0.0.1:3000'
$env:INVENTORY_BENCHMARK_RUN_ID = 'phase06-10k-a'
node scripts/benchmark-inventory.mjs --execute --scale 10000
```

Do not remove the test volume automatically. Retain the run evidence first;
any later `docker compose down -v` is an explicit operator decision for this
disposable test target only, never a test-script action.

## Index review

The migration adds `InventoryItem(warehouseId, skuId)` for branch lookup,
`InventoryItem(skuId, availableQuantity)` for availability, and location /
warehouse status indexes for visibility joins. Final approval needs observed
planner output; index declarations alone are not performance evidence.
