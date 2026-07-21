# Apple333 deployment safety policy

## Non-negotiable defaults

- Preflight is read-only. Install, update, and uninstall require `--apply`.
- No script uses `prisma db push`, `prisma migrate reset`, `docker system
  prune`, `docker compose down -v`, blanket `rm -rf`, or automatic seeding.
- Production database changes require reviewed Prisma migrations. A missing
  migration bundle is a hard stop, not permission to infer a schema.
- The named Phase 04.1 PIM baseline is test/CI-only and hard-blocked by this
  release. No environment variable, command option, or local state edit can
  lift the block. A later reviewed release must introduce a release-specific
  approval and adoption procedure; it must never be an automatic adoption path
  for an existing database.
- Secrets are never printed, committed, or copied into deployment state. The
  protected env parser accepts only a declared plain `KEY=value` allowlist and
  is never shell-sourced.
- No foreign/ambiguous resource is reused, replaced, stopped, or deleted
  automatically.

## Bare-metal PM2 lane

- Bare-metal PM2 and the managed Docker Compose lane are mutually exclusive on
  the same host/port. The PM2 scripts detect a running labelled Docker project
  and stop rather than competing for `127.0.0.1:3000`.
- PM2 reads only root `.env.production` through a strict plain `KEY=value`
  parser. The file must be a regular file with no group/other read permission;
  it is never shell-sourced, logged, copied into snapshots, or committed.
- PM2 always uses `ecosystem.config.js` and the Next.js standalone runtime
  `.next/standalone/server.js`. `next start` is not a production path for this
  project.
- A PM2 update refuses a dirty tracked Git worktree, fetches the configured
  remote branch, and uses a fast-forward merge only. It never calls `git reset`,
  discards local work, or overwrites the protected environment file.
- Release snapshots contain commit/build/PM2-status and environment-key
  metadata only. They contain neither raw environment values nor PM2 process
  environments.
- The PM2 updater performs no Prisma migration in the current release. It
  verifies connectivity with read-only `SELECT 1`, then validates application
  health. The immutable Phase 04.1 production migration block applies equally
  to this lane.
- A failed PM2 deployment may restore a previous application build and exact
  commit. It never attempts database rollback, reset, `db push`, or schema
  adoption.

## Ownership proof

A resource is reusable only when all applicable evidence agrees:

1. state file: project key, environment, compose project, canonical install
   root, install ID, database name, and database schema match the current
   checkout/configuration;
2. Docker labels: `com.apple333.project`, `com.apple333.managed`, environment,
   and install ID match; and
3. PostgreSQL marker: dedicated schema contains an active
   `apple333_deployment_metadata` row with the same project, environment, and
   install ID.

The possible classifications are:

| Classification | Behavior |
| --- | --- |
| `OWNED_CURRENT` | May be reused/updated by the matching deployment scripts |
| `OWNED_OTHER_APPLE333` | Stop; another Apple333 installation owns it |
| `EMPTY` / `NOT_CREATED` | May be initialized only by a fresh install after migrations exist |
| `RECOVERY_REQUIRED` | Stop; an owned marker records an incomplete, failed, or uninstall-in-progress operation |
| `FOREIGN` / `AMBIGUOUS` | Stop and ask for a new isolated target or separate approved cleanup |
| `UNREACHABLE` | Stop database-changing work until the resource can be inspected |

Names alone never prove ownership. A database called `apple333`, a generic
volume called `postgres_data`, or a `public` schema is not accepted as proof.

For an update, the PostgreSQL, Redis, and MinIO volumes must each still be
`OWNED_CURRENT`. The scripts do not recreate a missing data volume, even when
the state file is otherwise valid. Treat that condition as a recovery incident
and stop for investigation or a reviewed restore.

## Phase 04.1 release gate

The initial PIM migration creates the accumulated platform schema and has only
been exercised on a pristine disposable PostgreSQL target. Its current server
deployment status is **BLOCKED**. The immutable guard is intentionally inside
the executable deployment library, not an operator-controlled `.env` value.
The release requirements for lifting it are documented in
[RELEASE-GATES.md](RELEASE-GATES.md). A typed confirmation is not an approval
for this migration.

## Foreign resource consent

When preflight finds a foreign resource, it reports the exact name and asks
whether to show removal guidance. It does **not** interpret a normal yes/no as
permission to delete data.

After an independent backup, a human may run
`purge-unrelated.sh --volume NAME` or `--network NAME`. That script displays
the exact target and requires the typed phrase:

```text
PURGE UNRELATED <type> <name>
```

It cannot drop external/shared PostgreSQL databases. Database/schema removal
needs a separate owner-approved, backup-verified procedure outside this bundle.

## Data retention and recovery

- Default uninstall retains PostgreSQL, Redis, and MinIO volumes, state, secret
  config, checkout, and backups.
- A PostgreSQL/Redis data purge first makes an encrypted custom-format `pg_dump`
  backup, then requires a
  typed Apple333-specific confirmation.
- MinIO/object-storage data has no automatic purge path until an approved object
  backup and restore procedure exists.
- A failed install/update marks the database marker as `failed` when possible
  and preserves resources for inspection. Do not rerun install blindly; use
  preflight and investigate the marker/status first.
- Application rollback is separate from database rollback. Restore a database
  only from a reviewed backup with a compatible application release.

## Legacy installations

There is no automatic adoption of a legacy database. It must be proven with a
reviewed baseline migration, expected schema fingerprint, and explicit owner
approval. Until then, choose a new isolated database/schema.
