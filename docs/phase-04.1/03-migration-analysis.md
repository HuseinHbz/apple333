# Phase 04.1 — migration analysis

## Generated bundle

- Folder: `prisma/migrations/20260713000000_phase_04_1_pim_activation/`
- Provider lock: `prisma/migrations/migration_lock.toml`
- Generation method: offline `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
- Target semantics: a pristine, isolated PostgreSQL baseline only

`prisma migrate dev --create-only` was deliberately not used in this
workstation because Prisma would require a disposable shadow database and no
Docker/PostgreSQL runtime is available here. The offline diff does not open a
database connection. The resulting SQL must still be applied and verified by
`prisma migrate deploy` only in the dedicated test/CI environment.

## Manual SQL review

| Operation | Count |
| --- | ---: |
| `CREATE TYPE` | 18 |
| `CREATE TABLE` | 38 |
| `CREATE INDEX` / `CREATE UNIQUE INDEX` | 96 |
| `ALTER TABLE ... ADD CONSTRAINT` | 50 |
| `DROP`, `TRUNCATE`, `DELETE` | 0 |
| destructive `ALTER TABLE` | 0 |

The final constraints are foreign keys only; their `ON DELETE` clauses express
the declared relation semantics and are not destructive operations during an
initial creation.

The baseline also creates `ProductImportBatch.applyAttemptToken`,
`ProductImportBatch.applyStartedAt`, and the `(status, applyStartedAt)` index.
They implement a bounded apply lease; no existing rows are altered because this
bundle is valid only for a pristine database.

## Approval boundary

The SQL is accepted for the disposable `apple333_pim_test` container and an
equivalent ephemeral CI service. It is **not** an approval to run on a database
that already contains Apple333 tables, an unknown schema, or production data.

For a legacy adoption, stop before execution and create a separate migration
design covering schema introspection, migration-history baselining, lock
windows, backup proof, `ProductMedia` backfill, and rollback validation.
