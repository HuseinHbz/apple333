# Phase 06.1 — Safe Reproducibility Runbook

This runbook reproduces Phase 06.1 evidence only against a disposable, labelled, loopback-only PostgreSQL environment. It must never be pointed at production, staging, a shared development database, or a production Redis/object-storage service.

## Executed evidence snapshot (2026-07-22)

This runbook was executed against labelled disposable resources and then the
owned container, volume, and network were removed through the guarded cleanup
path. The recorded results were:

- PostgreSQL and Redis test services healthy on loopback-only configuration;
- two guarded migrations applied, with 46 tables inspected;
- deterministic E2E seed passed twice after invalid fixture balance and
  identifier-collision corrections;
- real PostgreSQL suite passed 2 files / 13 tests;
- reconciliation was zero drift before and after browser execution
  (`canonical=12`, `projection=12`);
- standalone production readiness returned HTTP 200 with configuration,
  database, and Redis all `ok`;
- Playwright passed 17 scenarios in 20.2 seconds; and
- separate fresh 10k and 100k benchmark databases met the p95 target with
  index-scan plans.

This is local disposable-environment evidence only. It does not close the
dependency-security or CI approval gates described at the end of this runbook.

## Preconditions

- Run from the repository root in PowerShell.
- Node.js meeting the repository engine (`>=20.18.0`) and pnpm are available.
- Docker Engine / Docker Desktop with Docker Compose is installed and running. If it is absent, obtain explicit operator approval before installing it; installation may require WSL and a restart.
- Do not continue if the current environment contains a production `DATABASE_URL` or any non-loopback target.
- Do not use `prisma db push`, `prisma migrate reset`, `docker system prune`, `docker volume prune`, or a generic `docker compose down --volumes` command for this work.

## 1. Install project dependencies reproducibly

```powershell
pnpm install --frozen-lockfile
pnpm exec prisma validate
pnpm exec prisma generate
pnpm exec playwright install chromium
```

If the frozen install fails, stop and record the exact failure. Do not regenerate a lockfile silently.

## 2. Create the local test environment file safely

The copied file is local-only and must not be committed.

```powershell
if (-not (Test-Path .env.inventory-test)) {
  Copy-Item .env.inventory-test.example .env.inventory-test
}
```

Review only the non-secret identity fields. They must resolve to all of the following:

- `NODE_ENV=test`
- `APPLE333_TEST_DB=1`
- database/user `apple333_phase06_test`
- host `127.0.0.1`, port `55433`, schema `public`

Load the local test values into the current PowerShell process without printing them:

```powershell
Get-Content .env.inventory-test | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$') {
    Set-Item -Path "Env:$($matches[1])" -Value $matches[2]
  }
}
$env:DATABASE_URL = $env:INVENTORY_TEST_DATABASE_URL
$env:APPLE333_E2E_TEST_DB = '1'
```

If the password is changed, URL-encode reserved characters in `INVENTORY_TEST_DATABASE_URL`; keep it consistent with `INVENTORY_TEST_POSTGRES_PASSWORD`.

## 3. Start and verify only the owned disposable PostgreSQL service

Review the fully resolved Compose configuration first, then start it:

```powershell
docker compose --env-file .env.inventory-test -f docker-compose.inventory-test.yml config
docker compose --env-file .env.inventory-test -f docker-compose.inventory-test.yml up -d
docker compose --env-file .env.inventory-test -f docker-compose.inventory-test.yml ps
pnpm inventory:test:preflight
```

The expected owned resource names are:

- container: `apple333-phase06-postgres`
- volume: `apple333_phase06_test_postgres_data`
- network: `apple333_phase06_test_network`

Verify the live identity inside the disposable container before migration:

```powershell
docker compose --env-file .env.inventory-test -f docker-compose.inventory-test.yml exec -T apple333-phase06-postgres psql -U apple333_phase06_test -d apple333_phase06_test -c "SELECT current_database(), current_user, inet_server_addr(), inet_server_port(), version();"
```

Stop immediately if the preflight fails, the identity differs, the service is unhealthy, or a hostname/address is not local. Do not "fix" such a result by changing a safety check.

## 4. Migrate and inspect the isolated database

```powershell
pnpm inventory:test:migrate
```

This approved wrapper fails closed, runs `prisma migrate deploy`, and inspects migrations/constraints/indexes. Do not substitute `prisma db push` or `prisma migrate reset`.

## 5. Execute deterministic small-dataset evidence

```powershell
pnpm inventory:e2e:seed
pnpm test:inventory-db
pnpm inventory:reconcile
```

Record exact output, exit codes, test counts, database logs, and reconciliation output. Any drift, test failure, or rollback failure blocks Phase 06.1 approval.

## 6. Build and run production-mode E2E evidence

Build first:

```powershell
$env:NODE_ENV = 'production'
$env:DATABASE_URL = $env:INVENTORY_TEST_DATABASE_URL
pnpm build
```

Return the test controls before launching the E2E wrapper:

```powershell
$env:NODE_ENV = 'test'
$env:DATABASE_URL = $env:INVENTORY_TEST_DATABASE_URL
pnpm test:e2e:inventory
```

The wrapper requires `.next/standalone/server.js`, verifies the test database, seeds only isolated fixtures, and starts its Playwright server in production mode. Preserve Playwright traces/screenshots/videos and PostgreSQL/application logs for any failure.

## 7. Run 10k and 100k benchmarks

The benchmark requires a separate local production-mode application process listening only on `127.0.0.1:3000`. In a second PowerShell terminal, load the same `.env.inventory-test`, then run:

```powershell
$env:DATABASE_URL = $env:INVENTORY_TEST_DATABASE_URL
$env:NODE_ENV = 'production'
pnpm start:standalone
```

In the evidence terminal, keep `NODE_ENV=test`, set the explicit benchmark controls, and use a new run ID for every execution:

```powershell
$env:NODE_ENV = 'test'
$env:DATABASE_URL = $env:INVENTORY_TEST_DATABASE_URL
$env:INVENTORY_BENCHMARK_ALLOW_SEED = '1'
$env:INVENTORY_BENCHMARK_API_BASE_URL = 'http://127.0.0.1:3000'
$env:INVENTORY_BENCHMARK_RUN_ID = 'phase061-10k-20260721'
node scripts/benchmark-inventory.mjs --execute --scale 10000

$env:INVENTORY_BENCHMARK_RUN_ID = 'phase061-100k-20260721'
node scripts/benchmark-inventory.mjs --execute --scale 100000
```

Record each JSON result, p50/p95/p99, errors, query plans, and host CPU/memory observation. Do not reuse a run ID or reuse results from another database.

## 8. Complete quality and security evidence

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm build
pnpm exec prisma validate
pnpm exec prisma generate
pnpm audit --prod --audit-level=high
```

The latest 2026-07-22 production audit is **blocked** with `critical=0`,
`high=2`, and `moderate=3`. Do not suppress an advisory. Resolve the High and
Moderate findings with compatible tested updates or record a formal security
owner decision with required owner, dates, expiry, and compensating control.

## 9. Safe cleanup

First perform a non-destructive ownership check:

```powershell
$env:NODE_ENV = 'test'
$env:DATABASE_URL = $env:INVENTORY_TEST_DATABASE_URL
pnpm inventory:test:cleanup
```

Only when every listed resource has the expected ownership labels and removal is intentionally desired, use the explicit acknowledgement:

```powershell
$env:APPLE333_PHASE06_CLEANUP_ACK = 'DELETE_OWNED_PHASE06_RESOURCES'
node scripts/cleanup-phase06-test-environment.mjs --destroy-owned
```

The cleanup script inspects the exact container, volume, and network before calling Compose. It refuses resources that are missing the Phase 06.1 ownership labels and never uses `--remove-orphans`. If a resource is unknown, mismatched, or shared, **do not delete it**; stop and ask the owning operator.

## 10. Evidence completion rule

Update reports 02–15 only with actual command output. The local runtime,
database, E2E, and benchmark gates have execution evidence, but Phase 06.1
must remain unapproved until the dependency-security findings, remaining RBAC
actor-matrix scope, and CI execution/artifacts are resolved.
