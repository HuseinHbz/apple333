# Apple333 server deployment

This directory is the only supported operational entry point for a managed
Apple333 server. It contains a production Docker Compose stack, a non-secret
environment template, and scripts for preflight, install, update, status, and
uninstall.

Read [SAFETY-POLICY.md](SAFETY-POLICY.md) before running a mutating command.
Every future project change must review this directory as required by
[MAINTENANCE_RULE.md](MAINTENANCE_RULE.md).

## Important current release gate

The current repository has no reviewed Prisma migration bundle in
`prisma/migrations/`. Therefore `install.sh --apply` intentionally refuses to
initialize or change PostgreSQL. It never falls back to `prisma db push`,
`migrate reset`, or an inferred schema. Create and approve an additive baseline
migration first, then use this deployment bundle.

## What the scripts protect

Before every installation, update, or removal, the scripts inspect:

- the deployment state marker in `APPLE333_STATE_DIR`;
- Docker volumes, network, and containers by explicit `com.apple333.*` labels;
- the target PostgreSQL schema and its `apple333_deployment_metadata` marker;
- the configured host port; and
- the exact source checkout path, environment, compose project, and install ID.

Only a resource with matching Apple333 ownership evidence is reused
automatically. A resource with the same name is **not** enough evidence.
Unknown, foreign, ambiguous, or occupied resources stop the operation. The
scripts ask whether to display removal guidance but never delete anything
automatically.

## Files

| Path | Purpose |
| --- | --- |
| `.env.production.example` | Non-secret production configuration template |
| `compose.production.yml` | Isolated app, nginx, PostgreSQL, and Redis stack |
| `bin/preflight.sh` | Read-only ownership/dependency inspection |
| `bin/install.sh` | Fresh installation after explicit `--apply` |
| `bin/update.sh` | Safe release update with explicit migration decision |
| `bin/status.sh` | Read-only Compose/readiness status |
| `bin/uninstall.sh` | Stop services; data purge is separately confirmed |
| `bin/purge-unrelated.sh` | Narrow manual cleanup for one named Docker volume/network |

## Server prerequisites

- Linux server with Docker Engine and Docker Compose v2;
- `bash`, `realpath`, `openssl`, `flock`, `curl`, and standard GNU user tools;
- an HTTPS reverse proxy or load balancer in front of the loopback-bound nginx
  port; and
- a dedicated `/opt/apple333` checkout and `/var/lib/apple333` state/backup
  directory owned by the deployment operator.

Do not expose PostgreSQL or Redis to the internet. The production Compose file
does not publish those ports.

This bundle manages its own labelled PostgreSQL container and rejects a
`DATABASE_URL` that points to an external/shared database. That prevents the
scripts from accidentally treating another application's database as Apple333.
Use a separate, reviewed operational design for managed external databases.

## First installation

```bash
sudo mkdir -p /opt/apple333 /var/lib/apple333/backups
sudo chown -R "$USER":"$USER" /opt/apple333 /var/lib/apple333
git clone https://github.com/HuseinHbz/apple333.git /opt/apple333
cd /opt/apple333

cp deploy/.env.production.example deploy/.env.production
chmod 600 deploy/.env.production
# Edit every placeholder. Use a dedicated PostgreSQL schema such as apple333.
# Generate AUTH_SECRET and POSTGRES_PASSWORD with: openssl rand -hex 32

bash deploy/bin/preflight.sh
# After a reviewed Prisma migration bundle exists:
bash deploy/bin/install.sh --apply
```

The first successful installation generates `APPLE333_INSTALL_ID`, writes a
protected state marker outside Git, labels all managed Docker resources, then
creates a database marker. It applies only reviewed Prisma migrations and
checks `/api/ready` before reporting success.

## Editing configuration safely

1. Back up `deploy/.env.production` in the operator's secret manager.
2. Edit only `deploy/.env.production`; do not edit generated state files or
   Docker volumes by hand.
3. Run `bash deploy/bin/preflight.sh` and review every resource status.
4. Use an explicit update command:

```bash
# For a reviewed release with no database change
bash deploy/bin/update.sh --apply --skip-migrations

# For a reviewed release that includes approved Prisma migrations
bash deploy/bin/update.sh --apply --apply-migrations
```

`--apply-migrations` creates a PostgreSQL custom-format backup first. The
script does not attempt an automatic database rollback because migrations may
not be reversible.

## Routine code update

```bash
cd /opt/apple333
git fetch origin
git checkout <reviewed-commit-or-tag>
bash deploy/bin/preflight.sh
bash deploy/bin/update.sh --apply --skip-migrations
```

Use `--apply-migrations` only after reviewing the SQL, backup, compatibility,
and rollback plan for that release.

## Status and logs

```bash
bash deploy/bin/status.sh
docker compose --project-name apple333-production \
  --env-file deploy/.env.production -f deploy/compose.production.yml logs -f app
```

Liveness is `/api/health`; deployment readiness is `/api/ready` and includes a
configuration plus PostgreSQL query check.

Repository contributors can run `pnpm test:deploy` to verify the static safety
invariants for labels, maintenance policy, and destructive-operation guards.

## Removal

```bash
# Stop/remove Apple333 containers and network; retain data and configuration.
bash deploy/bin/uninstall.sh --apply

# Create a backup, then remove only verified Apple333 PostgreSQL/Redis volumes.
bash deploy/bin/uninstall.sh --apply --purge-owned-data
```

The purge command requires a typed confirmation. It retains the source
checkout, `.env.production`, and backup files. It never calls `docker system
prune`, `docker compose down -v`, `prisma migrate reset`, or `DROP DATABASE`.

## Existing resources and foreign data

If preflight finds resources that are not proven Apple333 resources, it aborts
the operation. Choose one of these paths:

1. configure a new compose project, port, database, and schema (recommended);
2. prove/adopt a verified legacy Apple333 installation through a reviewed
   migration/ownership procedure; or
3. take an independent backup and use `purge-unrelated.sh` for one exact
   Docker volume or network.

External or shared PostgreSQL databases are never dropped by this repository.
Use a dedicated database/schema or obtain a separate approved database-change
procedure from its owner.
