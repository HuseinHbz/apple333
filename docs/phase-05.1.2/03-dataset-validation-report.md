# Phase 05.1.2 - Module 03: Dataset validation report

**Status:** BLOCKED - deterministic fixture implementation validated; no dataset has been seeded in this phase.

**Evidence date:** 2026-07-20

**Scope:** source review, fail-closed preflight, and unit tests only.
**Database, migration, seed, cleanup, production, and staging access:** none.

## Decision

The repository contains a deterministic synthetic catalog fixture generator at
[scripts/seed-performance-data.ts](../../scripts/seed-performance-data.ts).
It is suitable as a candidate input to an isolated benchmark, but it has not
been executed for Phase 05.1.2. Consequently, this report records no product
count, relation count, seed duration, database identity, or fixture run ID as
real-environment evidence.

The fixture must not be run against a shared development database, a staging
application database, or production. It is designed for a fresh disposable PIM
test database only.

## Evidence observed locally

The following local capability check was performed without any supplied
database URL or service connection:

| Check | Observed result |
| --- | --- |
| Node.js | v24.14.0 |
| pnpm | 11.9.0 |
| Docker command | Not available |
| psql command | Not available |
| redis-cli command | Not available |
| PostgreSQL/Redis/Docker services | None detected |
| pnpm pim:test:preflight | Expected exit 1: NODE_ENV, APPLE333_PIM_TEST_DB, and PIM_TEST_DATABASE_URL were absent |

pim:test:preflight validates environment strings only; it did not open a
database connection. Its expected refusal confirms that an unqualified target
cannot silently be used for a seed.

The source-only test command below passed on the workstation. It does not open
a database connection or write a fixture:

~~~text
pnpm exec vitest run tests/unit/seed-performance-data.test.ts \
  tests/unit/storefront-search-evaluation.test.ts \
  tests/unit/storefront-search-foundation.test.ts

3 test files passed; 16 tests passed.
~~~

The four tests in seed-performance-data.test.ts validate accepted scales,
deterministic in-memory records, the expected catalog taxonomy, and rejection
of a production-like URL. They do **not** prove that PostgreSQL accepted the
rows or that a completed fixture exists.

## Fixture contract reviewed in source

The generator accepts only 10000 and 100000 as scales. For a unique run ID, it
produces only synthetic data marked phase-05.1-performance:<run-id>. The
generated names, IDs, slugs, and SKU codes include the chosen run ID; no live
Apple, customer, order, inventory, or production data is read.

| Entity / relation | 10,000-product run | 100,000-product run | Source contract |
| --- | ---: | ---: | --- |
| Catalog products | 10,000 | 100,000 | One synthetic product per ordinal |
| Active variants | 40,000 | 400,000 | Four variants per product |
| SKU records | 40,000 | 400,000 | One SKU per variant |
| Product specifications | 40,000 | 400,000 | Four product-scoped specifications per product |
| Categories | 6 | 6 | iPhone, iPad, Mac, Apple Watch, AirPods, Accessories |
| Brands | 4 | 4 | Apple, Belkin, Anker, Spigen |
| Product attributes | 4 | 4 | Chipset, display, camera, battery |
| Attribute values | 16 | 16 | Four values per attribute |
| Category-attribute assignments | 24 | 24 | Four attributes across six categories |

Variant data contains deterministic color and storage values. The currently
implemented color set is Black Titanium, Natural Titanium, Blue, and White;
the storage set is 128GB, 256GB, 512GB, and 1TB. Each product also includes
synthetic category/model, price, feature-flag, and structured specification
data. It does not fetch images or media.

## Safety and repeatability controls

Before loading Prisma, the generator requires all of the following:

~~~text
NODE_ENV=test
APPLE333_PIM_TEST_DB=1
PERFORMANCE_SEED_ALLOW_WRITE=1
PIM_TEST_DATABASE_URL=postgresql://apple333_pim_test:<password>@127.0.0.1:55432/apple333_pim_test?schema=public
DATABASE_URL=<unset, or exactly PIM_TEST_DATABASE_URL>
~~~

At runtime it additionally verifies the connected database name, role, schema,
and completed 20260713000000_phase_04_1_pim_activation migration record. A
new run ID creates reference data and catalog rows in bounded transactions. A
complete matching run ID is verification-only; a partial or unexpected run ID
fails without repair, deletion, truncation, reset, or upsert. The generator
does not create a database, run a migration, or remove records.

These controls are source and unit-test evidence, not proof that they have run
against an actual PostgreSQL service during this phase.

## Missing real-execution evidence

None of the following exists for Phase 05.1.2:

- a disposable PostgreSQL service and recorded version;
- a completed guarded migration on that disposable target;
- a unique 10k run ID and its self-verification output;
- a unique 100k run ID and its self-verification output;
- SQL count/foreign-key relation verification output;
- seed duration, runner CPU/memory limits, or retained redacted logs; or
- evidence that the target was independent of production and shared staging.

The Phase 04.1 benchmark fixture and its completed historical benchmark are
not substitutes for these missing Phase 05.1.2 dataset runs. See
[04-database-performance-report.md](04-database-performance-report.md) for
their explicitly excluded historical context.

## Required isolated Linux CI / staging-worker sequence

This is a runbook for a future authorized validation job, **not** a record of
commands run by this phase. Use a fresh ephemeral Linux runner or an isolated
staging worker with PostgreSQL published only to that worker at
127.0.0.1:55432. Do not point these variables at the deployed staging
application database.

1. Provision a new PostgreSQL 16 service named apple333_pim_test with the
   dedicated apple333_pim_test role. Supply its password through CI secret
   injection; never place it in a report, source file, or command log.
2. Set the exact test-only variables below and run the guarded migration path.
   The migration script first inspects the disposable target and must remain
   fail-closed if it is not empty and isolated.

   ~~~bash
   export NODE_ENV=test
   export APPLE333_PIM_TEST_DB=1
   export PIM_TEST_DATABASE_URL='postgresql://apple333_pim_test:<injected-secret>@127.0.0.1:55432/apple333_pim_test?schema=public'

   pnpm prisma:validate
   pnpm prisma:generate
   pnpm pim:test:preflight
   pnpm pim:test:migrate
   ~~~

3. Compile the TypeScript generator into the job temporary directory. Do not
   add generated JavaScript to the repository.

   ~~~bash
   export SEED_OUTPUT_DIR="$RUNNER_TEMP/apple333-phase-05.1.2-seed"
   mkdir -p "$SEED_OUTPUT_DIR"
   pnpm exec tsc scripts/seed-performance-data.ts \
     --outDir "$SEED_OUTPUT_DIR" \
     --module NodeNext --moduleResolution NodeNext --target ES2022 \
     --esModuleInterop --skipLibCheck --noEmit false
   ~~~

4. For each scale, use a **separate fresh disposable database** and a new run
   ID. Keeping the targets separate prevents a nominal 100k run from being
   measured against the previous 10k records as well.

   ~~~bash
   export PERFORMANCE_SEED_ALLOW_WRITE=1
   export DATABASE_URL="$PIM_TEST_DATABASE_URL"

   node "$SEED_OUTPUT_DIR/seed-performance-data.js" \
     --execute --run-id phase0512-10k-a --scale 10000
   # On a separately provisioned fresh target:
   node "$SEED_OUTPUT_DIR/seed-performance-data.js" \
     --execute --run-id phase0512-100k-a --scale 100000
   ~~~

5. Preserve the generator completion line and run read-only count checks by
   fixture marker. The following query contains no write statement and uses a
   psql-quoted variable rather than interpolating the marker into SQL. Set the
   expected values to 10000/40000/40000/40000 for the 10k target or
   100000/400000/400000/400000 for the 100k target.

   ~~~bash
   export RUN_ID=phase0512-10k-a
   export EXPECTED_PRODUCTS=10000
   export EXPECTED_VARIANTS=40000
   export EXPECTED_SKUS=40000
   export EXPECTED_SPECIFICATIONS=40000

   psql "$PIM_TEST_DATABASE_URL" --set=ON_ERROR_STOP=1 \
     --set=marker="phase-05.1-performance:$RUN_ID" \
     --set=expected_products="$EXPECTED_PRODUCTS" \
     --set=expected_variants="$EXPECTED_VARIANTS" \
     --set=expected_skus="$EXPECTED_SKUS" \
     --set=expected_specifications="$EXPECTED_SPECIFICATIONS" <<'SQL'
   WITH product_set AS (
     SELECT id
     FROM "CatalogProduct"
     WHERE "searchText" LIKE (:'marker' || '%')
   ), variant_set AS (
     SELECT v.id, v."productId"
     FROM "CatalogVariant" AS v
     JOIN product_set AS p ON p.id = v."productId"
   ), actual AS (
     SELECT
       (SELECT count(*) FROM product_set) AS products,
       (SELECT count(*) FROM variant_set) AS variants,
       (SELECT count(*) FROM "ProductSku" AS s
         JOIN variant_set AS v ON v.id = s."variantId") AS skus,
       (SELECT count(*) FROM "ProductSpecification" AS ps
         JOIN product_set AS p ON p.id = ps."productId") AS specifications
   )
   SELECT
     actual.*,
     products = :'expected_products'::integer AS products_match,
     variants = :'expected_variants'::integer AS variants_match,
     skus = :'expected_skus'::integer AS skus_match,
     specifications = :'expected_specifications'::integer AS specifications_match
   FROM actual;
   SQL
   ~~~

6. Validate fixture relationships with a second read-only query. Every value in
   the result must be zero; a non-zero value is a failed fixture validation and
   must not be repaired in place.

   ~~~bash
   psql "$PIM_TEST_DATABASE_URL" --set=ON_ERROR_STOP=1 \
     --set=marker="phase-05.1-performance:$RUN_ID" <<'SQL'
   WITH product_set AS (
     SELECT id
     FROM "CatalogProduct"
     WHERE "searchText" LIKE (:'marker' || '%')
   ), variant_count AS (
     SELECT p.id, count(v.id) AS actual_count
     FROM product_set AS p
     LEFT JOIN "CatalogVariant" AS v ON v."productId" = p.id
     GROUP BY p.id
   ), specification_count AS (
     SELECT p.id, count(ps.id) AS actual_count
     FROM product_set AS p
     LEFT JOIN "ProductSpecification" AS ps ON ps."productId" = p.id
     GROUP BY p.id
   ), sku_count AS (
     SELECT v.id, count(s.id) AS actual_count
     FROM "CatalogVariant" AS v
     JOIN product_set AS p ON p.id = v."productId"
     LEFT JOIN "ProductSku" AS s ON s."variantId" = v.id
     GROUP BY v.id
   ), category_brand_relation AS (
     SELECT count(*) AS invalid_count
     FROM "CatalogProduct" AS p
     JOIN product_set AS fixture ON fixture.id = p.id
     LEFT JOIN "CatalogCategory" AS c ON c.id = p."categoryId"
     LEFT JOIN "Brand" AS b ON b.id = p."brandId"
     WHERE c.id IS NULL OR b.id IS NULL
   ), specification_relation AS (
     SELECT count(*) AS invalid_count
     FROM "ProductSpecification" AS ps
     JOIN product_set AS p ON p.id = ps."productId"
     LEFT JOIN "ProductAttribute" AS a ON a.id = ps."attributeId"
     LEFT JOIN "AttributeValue" AS av ON av.id = ps."attributeValueId"
     WHERE a.id IS NULL OR av.id IS NULL
   )
   SELECT
     (SELECT count(*) FROM variant_count WHERE actual_count <> 4)
       AS products_with_wrong_variant_count,
     (SELECT count(*) FROM specification_count WHERE actual_count <> 4)
       AS products_with_wrong_specification_count,
     (SELECT count(*) FROM sku_count WHERE actual_count <> 1)
       AS variants_with_wrong_sku_count,
     (SELECT invalid_count FROM category_brand_relation)
       AS products_with_missing_category_or_brand,
     (SELECT invalid_count FROM specification_relation)
       AS specifications_with_missing_attribute_or_value;
   SQL
   ~~~

   Record the count output and the zero-result relation check, but redact the
   connection string. Do not delete the fixture to make a rerun appear clean;
   dispose of the complete ephemeral environment after artifacts are retained.

## Acceptance condition

Module 03 is not complete until both scales have real, redacted completion and
relation-verification evidence from independently disposable targets. This
report authorizes no database operation by itself.
