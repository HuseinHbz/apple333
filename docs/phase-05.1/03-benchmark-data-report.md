# Phase 05.1 — Controlled benchmark dataset

## Scope and status

This document defines the deterministic synthetic catalog fixture used to
validate the Phase 05 storefront at two catalog scales. It is implementation
and execution guidance, **not** a benchmark result. The generator was not run
while producing this report, and it has no connection to production data.

The implementation is [seed-performance-data.ts](../../scripts/seed-performance-data.ts).
It is independent from `prisma/seed.ts`: the normal seed remains responsible
for roles and permissions, while this fixture is only for disposable local PIM
performance environments.

## Supported catalog scales

| Requested scale | Catalog products | Variants | SKUs | Structured specifications |
| --- | ---: | ---: | ---: | ---: |
| `10000` | 10,000 | 40,000 | 40,000 | 40,000 |
| `100000` | 100,000 | 400,000 | 400,000 | 400,000 |

Each product has exactly four active variants and four product-scoped
specifications. Reference data is created once per unique run:

- 6 categories: iPhone, iPad, Mac, Apple Watch, AirPods, and Accessories
- 4 brands: Apple, Belkin, Anker, and Spigen
- 4 reusable product attributes: chipset, display, camera, and battery
- 16 attribute values and 24 category-attribute assignments
- Variant color, storage, region, model number, price, comparison price, and
  synthetic warranty fields

The records are deliberately synthetic. Names include `Performance Fixture`,
all slugs/IDs/SKUs contain the selected run ID, image data is not fetched, and
no live Apple, customer, inventory, order, payment, or production records are
read.

## Determinism and repeatability

For a given `--run-id`, ordinal, and scale, product IDs, slugs, categories,
brands, variant combinations, storage values, colors, prices, feature flags,
and specification values are deterministic.

The script has three safe states for a run ID:

1. **New:** creates the full fixture in transactions of 250 products by
   default.
2. **Complete:** verifies its exact expected record counts and exits without
   writing, so accidental repeat execution is idempotent.
3. **Partial or unexpected:** fails without modifying or deleting anything.
   Use a new run ID rather than attempting cleanup in place.

The harness never uses `deleteMany`, `truncate`, `upsert`, schema migration,
or database creation. It deliberately leaves all fixture records retained in
the isolated test database for later benchmark inspection.

## Database safety boundary

No command is allowed to run from a production, staging, or developer database
connection. Before it imports Prisma or opens a connection, the script requires
all of the following:

```text
NODE_ENV=test
APPLE333_PIM_TEST_DB=1
PERFORMANCE_SEED_ALLOW_WRITE=1
PIM_TEST_DATABASE_URL=postgresql://apple333_pim_test:<password>@127.0.0.1:55432/apple333_pim_test?schema=public
DATABASE_URL=<unset, or exactly equal to PIM_TEST_DATABASE_URL>
```

It then verifies the connected PostgreSQL identity is exactly
`apple333_pim_test` / `apple333_pim_test` / `public`, and that migration
`20260713000000_phase_04_1_pim_activation` is completed. The generator does
not run or repair migrations.

## Operator usage

`package.json` is intentionally unchanged. The source is TypeScript and can be
compiled into a temporary directory using the existing TypeScript dependency;
the generated temporary file must not be committed.

### 1. Validate the source only

```powershell
pnpm typecheck
pnpm exec vitest run tests/unit/seed-performance-data.test.ts
```

### 2. Compile a temporary executable

```powershell
$temporaryOutput = Join-Path $env:TEMP 'apple333-phase-05.1-seed'
New-Item -ItemType Directory -Force -Path $temporaryOutput | Out-Null
pnpm exec tsc scripts/seed-performance-data.ts --outDir $temporaryOutput --module NodeNext --moduleResolution NodeNext --target ES2022 --esModuleInterop --skipLibCheck --noEmit false
node (Join-Path $temporaryOutput 'seed-performance-data.js') --help
```

Do **not** set a production `DATABASE_URL` while compiling or testing. The
help command does not connect to a database.

### 3. Execute only after the isolated test database was provisioned and migrated

```powershell
$env:NODE_ENV = 'test'
$env:APPLE333_PIM_TEST_DB = '1'
$env:PERFORMANCE_SEED_ALLOW_WRITE = '1'
$env:PIM_TEST_DATABASE_URL = 'postgresql://apple333_pim_test:<password>@127.0.0.1:55432/apple333_pim_test?schema=public'
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue

node (Join-Path $temporaryOutput 'seed-performance-data.js') --execute --run-id phase051-10k-a --scale 10000
node (Join-Path $temporaryOutput 'seed-performance-data.js') --execute --run-id phase051-100k-a --scale 100000
```

Use different run IDs for the 10k and 100k datasets. The commands above are
examples only and were **not executed** as part of this implementation.

## Handoff to performance validation

Module 04 should measure query plans and application paths against a fresh,
complete run of each scale, record the run ID and hardware/container limits,
and distinguish cold from warm cache results. It must not treat this fixture
description as benchmark evidence.

## Verification added

`tests/unit/seed-performance-data.test.ts` checks that only 10k and 100k are
accepted, the generated data is deterministic, variant/specification counts are
correct, required catalog taxonomy is present, and a production-like URL fails
before a database client is loaded.
