# Isolated PIM PostgreSQL test environment

This environment is for **local, disposable Phase 04.1 verification only**.
It is not a staging or production deployment and must never be pointed at an
existing database.

## Safety boundary

- Compose project: `apple333-pim-test`
- Database: `apple333_pim_test`
- Role: `apple333_pim_test`
- Host binding: literal IPv4 loopback only (`127.0.0.1`); DNS names are rejected
- Host port: `55432`, deliberately not the default PostgreSQL port
- Separate named volume and internal network, both labeled `pim-test`
- The file is standalone and is not included by production Compose definitions.

The `scripts/verify-pim-test-environment.mjs` preflight is fail-closed. It
does not import Prisma, invoke Docker, connect to PostgreSQL, or print a URL or
password. It requires `NODE_ENV=test`, the explicit `APPLE333_PIM_TEST_DB=1`
opt-in, and checks the dedicated role, database, literal loopback host, port,
and `schema=public`.

## Prepare (no database action)

```powershell
Copy-Item .env.pim-test.example .env.pim-test
# Export only the dedicated test values into this terminal. Do not load a
# general .env file or reuse a development/staging DATABASE_URL.
$env:NODE_ENV = 'test'
$env:APPLE333_PIM_TEST_DB = '1'
$env:PIM_TEST_DATABASE_URL = 'postgresql://apple333_pim_test:local-test-only-change-me@127.0.0.1:55432/apple333_pim_test?schema=public'
node scripts/verify-pim-test-environment.mjs
```

Keep `.env.pim-test` local. It is ignored by Git. Change the sample password
before starting a container, and URL-encode reserved password characters in
`PIM_TEST_DATABASE_URL`.

## Start the disposable service (explicit operator action)

Only after the preflight passes, an operator may choose to run:

```powershell
docker compose --env-file .env.pim-test -f docker-compose.pim-test.yml up -d
```

This repository change does not execute that command, run Prisma, create a
migration, apply a migration, seed data, or inspect a database. Later Phase
04.1 migration work must repeat preflight and receive migration-review approval
before any Prisma command is considered.

## Hand-off to later database work

After an operator has explicitly started the disposable service and the
migration review remains approved, the guarded commands are:

```powershell
pnpm pim:test:migrate
pnpm test:pim-db
```

The migration runner first proves that the public schema has no application
objects (tables, views, sequences, types, routines, or extensions), runs only
`prisma migrate deploy`, then verifies every Prisma model table, the completed
checksum-bearing Phase 04.1 migration row, and Prisma status. The test runner
repeats target verification before executing real persistence tests. Both
commands copy `PIM_TEST_DATABASE_URL` only into their own
process-local `DATABASE_URL`; they never source a general `.env` or fall back
to another URL. The preflight is a guardrail, not authorization for destructive
database commands.
