# Apple333 Enterprise Platform

Apple333 is being rebuilt as a TypeScript-first enterprise platform for Apple
product commerce, administration, inventory, orders, and future CRM/ERP
modules.

## Current runtime

- Next.js 15 App Router
- React 19 and TypeScript strict mode
- Prisma with PostgreSQL as the target database
- Auth.js-compatible admin authentication and RBAC
- TanStack Query, Zustand, Zod, Vitest, and Playwright

The active application lives under `src/` and runs through pnpm. The legacy
static HTML/JavaScript storefront, Python HTTP server, and SQLite schema were
removed from this branch because they are not part of the current runtime.
Their Git history remains available on `legacy/local-v1`.

## Local development

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm prisma:generate
pnpm dev
```

Run the quality gates:

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

Prisma validation requires `DATABASE_URL`; use a local disposable PostgreSQL
instance or Docker Compose. Do not run migrations, `db push`, resets, or
destructive database commands without an approved migration plan.

## Documentation

- [Phase 03 implementation evidence](docs/phase-03/09-implementation-report.md)
- [Phase 03 quality gates](docs/phase-03/08-testing-report.md)
- [Database safety plan](docs/phase-03/database-plan.md)
- [Legacy cleanup record](docs/legacy-removal/phase-03-cleanup.md)
