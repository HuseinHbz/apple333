# Phase 06.1 — Environment and dependency audit

**Branch:** `feature/phase-06.1-inventory-runtime-evidence`
**Audit status:** Complete for the current workstation; runtime execution is blocked.
**Production resources touched:** No.

## Scope and method

This audit inspected the project manifest and lockfile, Prisma and Playwright
tooling, the inventory-test Compose/environment contracts, and the available
local command-line tools. It did not connect to a database, start a container,
change a global tool, or access a production resource.

## Detected environment

| Item | Observed result | Status |
| --- | --- | --- |
| Operating system / shell | Windows / PowerShell | Detected |
| Node.js | `v24.14.0` when the bundled Codex runtime is prepended to `PATH` | Available |
| Required Node engine | `>=20.18.0` in `package.json` | Satisfied by detected Node |
| Declared package manager | `pnpm@10.26.0` in `package.json` | Declared |
| Detected pnpm | `11.9.0` | Available; version differs from declaration |
| Prisma CLI / client | `6.7.0` | Available |
| Playwright | `1.55.1` | Available |
| Chromium | Playwright Chromium revision `1193` present under the local Playwright cache | Available |
| Git | `2.43.0.windows.1` | Available |
| curl | `8.21.0` | Available |
| Docker CLI | Not found | Blocking |
| Docker Compose | Not found | Blocking |
| PostgreSQL client (`psql`) | Not found | Blocking for direct SQL evidence |
| OpenSSL | Not found | Non-blocking for the current local test plan, but unavailable |
| Corepack | Not found | Reproducibility gap |
| WSL | Not installed (`wsl.exe --status`) | Blocking prerequisite for the usual Docker Desktop setup on this workstation |
| winget / Chocolatey / Podman | Not found | No supported local installer/runtime detected |
| Docker Desktop | Not found under `C:\Program Files\Docker` | Blocking |

## Dependency installation evidence

The repository dependency installation was run without changing the lockfile:

```text
pnpm install --frozen-lockfile
Already up to date
Done in 355ms using pnpm v11.9.0
```

This confirms that the checked-in dependency graph can be installed by the
available pnpm client. It does **not** resolve the declared pnpm version
mismatch, and it does not create database or browser-runtime evidence.

The browser availability check confirmed that the required Chromium binary is
already present. No browser download was required or performed during this
audit.

## Commands used or checked

```powershell
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm exec prisma --version
pnpm exec playwright --version
pnpm exec playwright install --list
docker --version
docker compose version
psql --version
openssl version
corepack --version
wsl.exe --status
git --version
curl.exe --version
```

Commands for Docker, Docker Compose, `psql`, OpenSSL, Corepack, WSL tooling,
winget, Chocolatey, and Podman were checked rather than assumed. The missing
tools were not installed because doing so would be a system-level change and
may require administrator approval and a restart.

## Known project tooling

The inventory runtime evidence is designed to use the following checked-in,
test-only assets:

- `.env.inventory-test.example`
- `docker-compose.inventory-test.yml`
- `scripts/verify-inventory-test-environment.mjs`
- `scripts/run-inventory-test-migrations.mjs`
- `scripts/run-inventory-database-tests.mjs`
- `scripts/run-inventory-e2e-tests.mjs`
- `scripts/benchmark-inventory.mjs`

The environment preflight is fail-closed: it requires `NODE_ENV=test`,
`APPLE333_TEST_DB=1`, literal `127.0.0.1`, port `55433`, role/database
`apple333_phase06_test`, one `schema=public` parameter, and no mismatched
ambient `DATABASE_URL`.

## Unresolved incompatibilities and remediation

1. **Docker/Compose and WSL are unavailable.** Install an approved local
   container runtime (normally Docker Desktop with its supported WSL 2
   prerequisite), then restart if the installer requires it. Do not use a
   remote or shared PostgreSQL server as a substitute.
2. **`psql` is unavailable.** Install the PostgreSQL client utilities if
   command-line SQL identity and inspection queries are required in addition
   to the checked-in Prisma inspector.
3. **Corepack is unavailable and pnpm is `11.9.0`, while the repository
   declares `pnpm@10.26.0`.** Establish the declared pnpm version through an
   approved project/tooling setup before treating dependency installation as
   fully reproducible.

Until item 1 is remedied, the migration, seed, PostgreSQL persistence,
concurrency, reconciliation, E2E, and benchmark gates remain **NOT
EXECUTED**. Static quality checks passing locally do not substitute for those
runtime gates.
