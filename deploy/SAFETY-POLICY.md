# Apple333 deployment safety policy

## Non-negotiable defaults

- Preflight is read-only. Install, update, and uninstall require `--apply`.
- No script uses `prisma db push`, `prisma migrate reset`, `docker system
  prune`, `docker compose down -v`, blanket `rm -rf`, or automatic seeding.
- Production database changes require reviewed Prisma migrations. A missing
  migration bundle is a hard stop, not permission to infer a schema.
- Secrets are never printed, committed, or copied into deployment state.
- No foreign/ambiguous resource is reused, replaced, stopped, or deleted
  automatically.

## Ownership proof

A resource is reusable only when all applicable evidence agrees:

1. state file: project key, environment, compose project, and canonical install
   root match the current checkout;
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
| `FOREIGN` / `AMBIGUOUS` | Stop and ask for a new isolated target or separate approved cleanup |
| `UNREACHABLE` | Stop database-changing work until the resource can be inspected |

Names alone never prove ownership. A database called `apple333`, a generic
volume called `postgres_data`, or a `public` schema is not accepted as proof.

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

- Default uninstall retains PostgreSQL and Redis volumes, state, secret config,
  checkout, and backups.
- A data purge first makes a custom-format `pg_dump` backup, then requires a
  typed Apple333-specific confirmation.
- A failed install/update marks the database marker as `failed` when possible
  and preserves resources for inspection. Do not rerun install blindly; use
  preflight and investigate the marker/status first.
- Application rollback is separate from database rollback. Restore a database
  only from a reviewed backup with a compatible application release.

## Legacy installations

There is no automatic adoption of a legacy database. It must be proven with a
reviewed baseline migration, expected schema fingerprint, and explicit owner
approval. Until then, choose a new isolated database/schema.
