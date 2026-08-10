# Phase 05 — Storefront Test Report

## Scope and safety

All commands below were run locally. No production service, production
database, migration, seed, deployment, or destructive command was used.

## Passing quality gates

| Scope | Command | Result |
| --- | --- | --- |
| TypeScript | `pnpm typecheck` | PASS |
| ESLint | `pnpm lint` | PASS |
| Production build | `pnpm build` | PASS |
| Unit suite | `pnpm exec vitest run tests/unit` | PASS — 25 files, 98 tests |
| Integration suite | `pnpm test:integration` | PASS — 7 files, 27 tests |
| Combined Vitest suite | `pnpm test` | PASS — 32 files, 125 tests |
| Storefront E2E | `pnpm exec playwright test tests/e2e/phase-05-storefront.spec.ts tests/e2e/storefront-routes.spec.ts` with `CI` unset | PASS — 11 tests |

The project exceeds the requested minimums for unit tests (98 versus 30),
integration tests (27 versus 15), and the scoped storefront E2E suite (11
versus 10).

## Phase 05 test coverage added

- Persian catalog URL normalization and supported catalog filters, including
  brand/model, category, color, storage, price, availability, sort, and page;
- PIM-backed search normalization, synonyms, request-envelope checks, and
  explicit approximate-result semantics;
- guest wishlist validation, malformed-storage recovery, cross-tab state, and
  hydration behavior;
- product metadata and truthful `Product`/`Offer`/breadcrumb schema behavior;
- sitemap shard, category, and no-index product handling; and
- public route, guest wishlist, account-foundation, category-discovery,
  keyboard skip-link, and robots E2E smoke paths.

## E2E environment findings

The default CI-mode command, `pnpm test:e2e`, could not start its standalone
web server on this Windows workspace. The failure occurred before test
execution, in the existing standalone-runtime preparation step while resolving
a `styled-jsx` filesystem link (`EPERM` on `stat`). No application code was
changed to suppress it.

The safe alternate developer-mode run started successfully. Its full suite
reported 11 passing tests and 3 failures outside Phase 05:

1. two pre-existing admin-auth redirect tests timed out while the test
   environment had no database configuration; and
2. the pre-existing health smoke test correctly failed because `DATABASE_URL`
   was absent and the health contract requires a connected database.

The scoped storefront suite passed all 11 tests despite the absent database,
because route shells intentionally render explicit loading/error states rather
than fabricated catalog data. Product-detail interaction with a real seeded
PIM record remains a staging-data test requirement.

## Acceptance implications

Functional code, static validation, build, unit, integration, and scoped
storefront E2E evidence are green. The global default E2E command is not green
in this workspace because of the documented standalone filesystem issue and
missing local database configuration. This report does not mark the production
E2E gate complete until it passes on a supported host with a non-production
database.
