# Phase 03 — Testing Report

**Execution date:** 2026-07-11
**Branch:** `feature/phase-03-admin-platform`

| Gate | Result | Evidence |
| --- | --- | --- |
| Prisma schema | Passed | `pnpm prisma:validate` with a process-local, non-secret validation URL |
| Prisma Client | Passed | `pnpm prisma:generate`; no migration or database write ran |
| TypeScript | Passed | `pnpm typecheck` |
| Lint | Passed | `pnpm lint` |
| Production build | Passed | `pnpm build`; 27 static pages generated and all App Router routes compiled |
| Unit | Passed | 7 files / 17 tests via `pnpm exec vitest run tests/unit` |
| Integration | Passed | 2 files / 4 tests via `pnpm test:integration` |
| Aggregate Vitest | Passed | 9 files / 21 tests via `pnpm test` |
| E2E | Passed | 2 Playwright tests via `pnpm test:e2e`: legacy smoke and unauthenticated admin protection |

## Covered behavior

- Permission allow/deny, any/all semantics, branch mismatch denial, and unknown permission rejection.
- System roles cannot be mutated; custom-role rules remain testable as a pure service invariant.
- Zod validation for role codes, settings, notifications, media paths, and upload signatures.
- Server-side user/audit list query validation, including allowed status values and bounded date ranges.
- Privilege-delegation denial: a role editor cannot assign a permission it does not hold.
- Unauthenticated admin API requests return a safe 401 envelope and no-store response.
- Cookie-authenticated mutations require same-origin checks.
- The unauthenticated `/admin` route redirects to the login screen, and direct admin API access is blocked.
- Existing public home/health smoke remains green.

## Environment limitation

Docker is not available in this workspace, so a database-backed authenticated login/role-assignment E2E flow was not executed. The test suite does not use a caller-controlled identity header or production database. A reviewed staging migration plus disposable PostgreSQL fixtures are required before claiming database-backed workflow coverage.

No test was skipped or disabled. The initial jsdom `File.arrayBuffer` fixture incompatibility and media storage-key extension validation failure were corrected and rerun successfully; details are in [quality-gate-report.md](quality-gate-report.md).
