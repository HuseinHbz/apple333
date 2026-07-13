# Phase 04.1 — PIM database and import security review

## Controls implemented or required

| Area                  | Control                                                                                                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database target       | A fail-closed PIM test guard requires `NODE_ENV=test`, explicit opt-in, the exact test database/user identity, literal `127.0.0.1:55432`, and `schema=public` before a migration or DB test.                                                  |
| Pristine-target proof | Before `migrate deploy`, the inspector rejects any public-schema table, view, sequence, enum/domain/range, routine, or extension. Afterward it requires all Prisma model tables plus the completed checksum-bearing Phase 04.1 migration row. |
| Production isolation  | No production URL is committed or accepted by the PIM test command. Production deployment uses the separate reviewed deploy flow.                                                                                                             |
| SQL injection         | Runtime persistence uses Prisma parameters and typed query APIs; no user-controlled SQL string is constructed.                                                                                                                                |
| Authorization         | Administrative routes use RBAC permissions and same-origin mutation checks before calling PIM services.                                                                                                                                       |
| Input mass assignment | PIM Zod schemas are strict and DTOs are explicitly projected.                                                                                                                                                                                 |
| Import payload        | Rows are bounded to 500 per batch, 80 fields per row, and 20,000 characters per string cell; only JSON scalars are accepted and spreadsheet formulas remain text in the CSV parser.                                                           |
| Media import source   | Referenced source files must be active `DOCUMENT` media records.                                                                                                                                                                              |
| Persistence           | Product, variant/SKU, specification, media, workflow, and import mutations execute in transactions. Import applies use an atomic attempt token and a 30-minute stale-lease recovery boundary.                                                 |

## Findings and disposition

| Severity | Finding                                                                                                       | Disposition                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Critical | No migration history means an unknown or existing database cannot be safely adopted.                          | BLOCKED by migration guard and review; do not run this baseline there.                                                                                                   |
| High     | Existing `ProductMedia` adoption needs a required CUID/timestamp backfill.                                    | BLOCKED; requires a separately designed legacy migration.                                                                                                                |
| High     | Concurrent import apply must be atomically state-claimed.                                                     | Addressed in Phase 04.1 service hardening and database tests; verify under PostgreSQL.                                                                                   |
| Medium   | A worker killed after claiming an import could leave it `APPLYING`.                                           | Addressed with an attempt token/start time and a bounded stale-lease reclaim; transactional writes mean an uncommitted worker has no partial product data to reapply.    |
| Medium   | Full update/upsert imports do not yet have a reviewed product/variant/SKU contract.                           | Preview rejects existing product slugs rather than silently applying a partial update.                                                                                   |
| Medium   | Client-provided source checksum cannot prove binary integrity without an approved storage-reader integration. | Documented limitation; do not treat it as server-verified evidence.                                                                                                      |
| Medium   | XLSX format is a contract only; binary parsing is not enabled.                                                | Reject/avoid unverified XLSX ingestion until a vetted parser and storage path are approved.                                                                              |
| Medium   | Search has no dedicated full-text index.                                                                      | Deferred to a measured search-platform change.                                                                                                                           |
| Moderate | `pnpm audit --prod --json` reports PostCSS `<8.5.10` through Next/Sentry and `uuid <11.1.1` through NextAuth. | No high/critical advisory was reported. No dependency was changed in this database phase; resolve through an approved dependency-upgrade change with regression testing. |

## Release gate

The test guard, Prisma deployment, real persistence tests, and CI all passed
against the disposable isolated target in [Quality run 29238326940](https://github.com/HuseinHbz/apple333/actions/runs/29238326940).
That evidence closes the Phase 04.1 test-environment security gate only. It is
not a production approval: the initial baseline remains blocked unless a later
reviewed release explicitly acknowledges it, and the two documented moderate
dependency advisories remain open. No credentials, database URLs, or private
keys belong in this repository.
