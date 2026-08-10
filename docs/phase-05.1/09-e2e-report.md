# Phase 05.1 — End-to-end validation report

## Decision and evidence status

**Status: not passed; Phase 05.1 E2E acceptance is blocked.**

The Playwright configuration now avoids the known Windows CI standalone-link failure by selecting `next start` when `CI=true` and the host platform is Windows. Linux CI keeps the standalone runtime path, so that artifact remains covered in the intended production-like environment.

This solves a Windows server-start mechanism only. It is not evidence that the storefront flows, health checks, or a full E2E run passed.

## Current suite inventory

The most recent full Windows invocation attempted the current **26 tests** in six files. It started successfully with `next start` on Windows, so the prior standalone-link startup issue is no longer the observed blocker. The run is not passing because the required local test database and `DATABASE_URL` are absent. A separate `document-title` defect on the error page was found during that run, fixed, and re-checked with the targeted product-detail axe test; it does not make the data-backed E2E suite accepted.

| Suite | Tests | Meaningful data requirement | Current evidence |
| --- | ---: | --- | --- |
| `smoke.spec.ts` | 1 | Application health must report a connected database. | Blocked when `DATABASE_URL` / local database is absent. |
| `admin-access.spec.ts` | 2 | Auth/session and protected API behavior require the test database. | Not accepted without database-backed execution. |
| `storefront-routes.spec.ts` | 4 | Route shells can render without seeded catalog data. | Insufficient by itself for storefront acceptance. |
| `phase-05-storefront.spec.ts` | 7 | Public route, wishlist, robots, and shell behavior. | Some shell assertions can render fallback UI; this does not validate PIM data flows. |
| `storefront-seeded.spec.ts` | 5 | Seeded published products, active variants/SKUs, inventory, and product SEO. | Blocked without the dedicated test database and deterministic fixture seed. |
| `storefront-accessibility.spec.ts` | 7 | Meaningful pages with PIM-backed catalog/product content plus a mobile-navigation semantic interaction. | Cannot be accepted from fallback/error-state pages. |
| **Current total** | **26** |  | **Not passing / not approved** |

## Windows CI server-mode change

`playwright.config.ts` selects the server command as follows:

| Context | Server command | Reason |
| --- | --- | --- |
| Local development | `pnpm dev` | Fast iterative local behavior. |
| Windows CI | `pnpm exec next start --hostname 127.0.0.1 --port 3000` | Avoids unreliable preservation of standalone dependency links on Windows. |
| Linux CI | `pnpm start:standalone` | Continues to exercise the reviewed standalone artifact after the build gate. |

The explicit override remains `APPLE333_E2E_SERVER_MODE=dev|next-start|standalone`. For a Windows CI evidence run, use `next-start` only after a successful production build and after the disposable test database is migrated and seeded.

The Windows `next start` retest emitted Next.js's warning that `next start` is
not the preferred command with `output: standalone`, but it did start and serve
the local build. Treat it strictly as the Windows compatibility workaround; the
Linux CI standalone run remains required for production-artifact acceptance.

## Actual blocker

The current workstation E2E attempt did not have a valid `DATABASE_URL` or a provisioned local test database. This blocks all paths that require a live PIM/auth/health dependency:

- `/api/health` expects `database: connected`, so the smoke assertion cannot pass without a database connection.
- Catalog, product detail, comparison, cart, and data-bearing accessibility routes need published PIM records and sellable variants.
- The deterministic seed script requires a loopback, test-only `apple333_test` or `apple333_e2e_test` database plus `APPLE333_E2E_TEST_DB=1`; it refuses production, staging, remote, and shared targets before Prisma connects.
- The five seeded storefront flows specifically require the synthetic `e2e-iphone-*` products, active SKUs, branch inventory, and no-index SEO records created by `scripts/seed-e2e-storefront.mjs`.

The failed full run also revealed that the Server Components error boundary did not set a non-empty document title, which axe correctly reported as a serious `document-title` violation. `src/app/error.tsx` now sets `خطایی رخ داد | Apple333`, `src/app/global-error.tsx` supplies a document title, and `src/app/not-found.tsx` has explicit metadata. The targeted product-detail axe check passed after that correction, although it still rendered the database-missing error boundary.

No test failure has been suppressed, skipped, reclassified as a pass, or hidden behind a fallback UI. The attempted 26-test run must therefore be reported as blocked rather than successful.

## Required reproducible validation sequence

Run only in a disposable local or Linux CI database with test-only credentials. Do not point these commands at staging or production.

```text
1. Provision a disposable PostgreSQL database and Redis service.
2. Set NODE_ENV=test, APPLE333_E2E_TEST_DB=1, and a loopback-only DATABASE_URL
   for apple333_test or apple333_e2e_test with schema=public.
3. pnpm prisma:validate
4. pnpm prisma:generate
5. pnpm exec prisma migrate deploy
6. node scripts/seed-e2e-storefront.mjs
7. NODE_ENV=production pnpm build
8. Run Playwright with the platform-appropriate server mode.
```

For Windows CI, the final command may explicitly use `APPLE333_E2E_SERVER_MODE=next-start pnpm test:e2e`. Linux CI should retain the standalone path after its standalone artifact check.

## CI wiring status

The quality workflow contains the intended ordering: a disposable PostgreSQL and Redis service, Prisma validation/generation, `prisma migrate deploy`, deterministic storefront fixture seeding, build, browser installation, and `pnpm test:e2e`.

That wiring still requires a real **Linux disposable-database CI validation** run and retained workflow artifacts. No GitHub Actions run ID, successful 26/26 result, database migration evidence, seed log, or Playwright artifact is available in this Phase 05.1 report. Treat the workflow as proposed wiring, not completed validation.

## Exit criteria

E2E acceptance may be claimed only when a recorded disposable-database run shows all 26 tests passing, including the five seeded commerce flows, six axe page checks, and the mobile-navigation semantic interaction, with:

- build and server-mode logs;
- Prisma migration and fixture-seed logs;
- database/Redis health evidence without secret values;
- Playwright HTML report plus failure artifacts when applicable; and
- a Linux CI run exercising the standalone artifact.

Until then, Phase 05.1 remains **not approved** for E2E quality.
