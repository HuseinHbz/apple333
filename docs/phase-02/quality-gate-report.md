# Phase 02.1 Quality Gate Report

This report records every quality-gate failure observed during Phase 02.1. No test, lint rule, TypeScript strictness setting, or Prisma validation was disabled to obtain a passing result.

## Prisma schema syntax — resolved

- **Command:** `pnpm prisma:validate`
- **Initial result:** Failed with Prisma P1012 and 28 schema syntax errors.
- **Error summary:** The parser did not recognize the generator, datasource, and model definitions.
- **Root cause:** `prisma/schema.prisma` used compressed semicolon-delimited definitions, which are not valid Prisma Schema Language syntax.
- **Resolution:** Rewrote the existing definitions as explicit, multiline Prisma blocks without changing the proposed data model or running a migration.

## Prisma environment validation — resolved

- **Command:** `pnpm prisma:validate`
- **Initial result:** Failed with Prisma P1012 because `DATABASE_URL` was not available in the shell.
- **Root cause:** The schema correctly requires a database URL, while no local `.env` file is committed or loaded in this workspace.
- **Resolution:** Supplied a non-secret, process-local validation URL. `prisma validate` then passed; no migration, reset, `db push`, or database connection operation was run.

## ESLint/Next flat-config compatibility — resolved

- **Command:** `pnpm lint`
- **Initial result:** Failed before linting because Node could not resolve `eslint-config-next/core-web-vitals`, then failed again because the legacy config object was not iterable under ESLint 9.
- **Root cause:** The installed Next config requires its explicit ESM entrypoint and compatibility conversion for ESLint 9 flat config.
- **Resolution:** Used the official Next Core Web Vitals config through `FlatCompat`, retained the rules, and added the required direct compatibility dependency. Subsequent linting exposed one raw internal anchor and two anonymous config exports; those were corrected without weakening linting.

## Vitest startup in the workspace sandbox — environmental limitation

- **Command:** `pnpm exec vitest run tests/unit`
- **Initial result:** Failed before collection with `Cannot read directory "../..": Access is denied` and could not resolve `vitest.config.ts`.
- **Root cause:** The same command and TypeScript configuration passed unchanged when executed outside the desktop workspace sandbox. The evidence indicates an esbuild filesystem-access limitation of the sandbox, rather than a source or test failure.
- **Resolution:** The Vitest config now resolves its project directory using `fileURLToPath(import.meta.url)`. The configured unit, integration, and aggregate Vitest runs passed in the approved host runner. Keep the current sandbox limitation in mind for local automation; do not change test behavior to mask it.

## Vitest/Playwright test-runner overlap — resolved

- **Command:** Aggregate Vitest discovery before test-scope configuration.
- **Initial result:** Vitest loaded `tests/e2e/smoke.spec.ts`, and Playwright correctly rejected `test()` being called under the wrong runner.
- **Root cause:** Default Vitest discovery had no boundary separating unit/integration files from the independently configured Playwright E2E suite.
- **Resolution:** Restricted Vitest discovery to `tests/unit/**/*.test.ts` and `tests/integration/**/*.test.ts`. Playwright tests remain enabled and continue to run through `pnpm test:e2e`.

## Playwright Chromium browser — blocked

- **Command:** `pnpm test:e2e`
- **Result:** Failed at browser launch.
- **Error summary:** Playwright could not find `chromium_headless_shell-1169` at the local Playwright browser-cache path.
- **Root cause:** Dependencies were installed with lifecycle scripts intentionally disabled, so the Playwright browser binary was not downloaded. The project dependency itself is present and the E2E test server started successfully.
- **Attempted remediation:** `pnpm exec playwright install chromium` was requested, but the required elevated approval was interrupted by the approval service before download began.
- **Recommended fix:** Explicitly approve `pnpm exec playwright install chromium`, then rerun `pnpm test:e2e`. This downloads only the local Playwright browser cache and does not alter application dependencies, source code, or the database.

## Playwright Chromium browser — resolved addendum (2026-07-11)

- **Command:** `pnpm exec playwright install chromium`, followed by `pnpm test:e2e`.
- **Result:** Chromium installed in the local Playwright cache and the E2E suite passed.
- **Scope confirmation:** The installation changed neither application dependencies nor source code, and did not access or modify a database.
