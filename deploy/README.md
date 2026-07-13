# Apple333 server deployment

This directory is the only supported operational entry point for a managed
Apple333 server. It contains a production Docker Compose stack, a non-secret
environment template, and scripts for preflight, install, update, status, and
uninstall.

Read [SAFETY-POLICY.md](SAFETY-POLICY.md) before running a mutating command.
Every future project change must review this directory as required by
[MAINTENANCE_RULE.md](MAINTENANCE_RULE.md).

## Important current release gate

This revision contains the Phase 04.1 initial PIM baseline in
`prisma/migrations/20260713000000_phase_04_1_pim_activation`. It is reviewed
only for a pristine isolated test/CI database and is **not** production
approval. This release hard-blocks it in both `install.sh` and
`update.sh --apply-migrations`; no environment variable, command flag, or
state-file edit can override the block. A later reviewed release must carry a
release-specific approval and adoption procedure. See
[RELEASE-GATES.md](RELEASE-GATES.md). The scripts never fall back to
`prisma db push`, `migrate reset`, or an inferred schema.

## What the scripts protect

Before every installation, update, or removal, the scripts inspect:

- the deployment state marker in `APPLE333_STATE_DIR`;
- Docker volumes, network, and Compose-project containers by explicit
  `com.apple333.*` labels;
- the target PostgreSQL schema and its `apple333_deployment_metadata` marker;
- the configured host port; and
- the exact source checkout path, environment, compose project, and install ID.

Only a resource with matching Apple333 ownership evidence is reused
automatically. A resource with the same name is **not** enough evidence.
An update also requires its PostgreSQL, Redis, and MinIO data volumes to still
be present and owned by the current installation; it will not recreate a
missing data volume. Unknown, foreign, ambiguous, or occupied resources stop
the operation. The scripts ask whether to display removal guidance but never
delete anything automatically.

## Files

| Path | Purpose |
| --- | --- |
| `.env.production.example` | Non-secret production configuration template |
| `compose.production.yml` | Canonical isolated app, one-shot migration task, nginx, PostgreSQL, Redis, MinIO, and optional observability stack |
| `RELEASE-GATES.md` | Current migration deployment blocks and evidence required for a future release |
| `monitoring/` | Private Prometheus scrape/alert rules and Grafana datasource provisioning |
| `nginx.public-edge.conf.template` | Reviewed opt-in public TLS/redirect configuration template |
| `systemd/` | Uninstalled, site-reviewed encrypted-backup service/timer templates |
| `bin/preflight.sh` | Read-only ownership/dependency inspection |
| `bin/install.sh` | Fresh installation after explicit `--apply` |
| `bin/update.sh` | Safe release update with explicit migration decision |
| `bin/status.sh` | Read-only Compose/readiness status |
| `bin/uninstall.sh` | Stop services; data purge is separately confirmed |
| `bin/purge-unrelated.sh` | Narrow manual cleanup for one named Docker volume/network |
| `../scripts/backup-db.sh` | Explicit encrypted PostgreSQL backup with checksum-verified secondary copy |
| `../scripts/restore-db-drill.sh` | Explicit isolated encrypted-backup restore drill |

## Server prerequisites

- Linux server with Docker Engine and Docker Compose v2;
- `bash`, `realpath`, `openssl`, `flock`, `curl`, `age`, `sha256sum`, and standard GNU user tools;
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
# Generate AUTH_SECRET, PostgreSQL, Redis, MinIO, and Grafana passwords with:
# openssl rand -hex 32
# Configure an approved age recipient and a separate encrypted backup path.
# Independently verify that the second path is truly off-host/offsite before
# relying on it for recovery; a different local pathname is not enough.

bash deploy/bin/preflight.sh
# This current release will stop here while the Phase 04.1 PIM baseline is
# production-blocked. Do not try to override it. Run only after a later
# reviewed release lifts the specific release gate.
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

`--apply-migrations` creates an encrypted PostgreSQL custom-format backup first.
The script requires the configured `age` recipient and does not attempt an
automatic database rollback because migrations may not be reversible.

## Routine code update

```bash
cd /opt/apple333
git fetch origin
git checkout <reviewed-commit-or-tag>
bash deploy/bin/preflight.sh
bash deploy/bin/update.sh --apply --skip-migrations
```

Use `--apply-migrations` only after reviewing the SQL, backup, compatibility,
rollback plan, and every applicable entry in
[RELEASE-GATES.md](RELEASE-GATES.md). For the current Phase 04.1 PIM baseline,
that option deliberately stops rather than applying the test/CI-only initial
schema.

## Status and logs

```bash
bash deploy/bin/status.sh
docker compose --project-name apple333-production \
  --env-file deploy/.env.production -f deploy/compose.production.yml logs -f app
```

Liveness is `/api/health`; deployment readiness is `/api/ready` and includes
configuration, PostgreSQL, and authenticated Redis checks. Prometheus reaches
`/api/metrics` directly from the private monitoring profile; the endpoint is
disabled by default, explicitly enabled only for the managed app service, and
nginx returns 404 for public metric requests.

Repository contributors can run `pnpm test:deploy` to verify the static safety
invariants for labels, maintenance policy, and destructive-operation guards.

## Backup schedule, observability, and CI/CD handoff

The backup script can copy an encrypted artifact to a separately configured
path, but it cannot prove that path is an independent host, mount, or storage
failure domain. The operator must establish and record that evidence, configure
alerting, and run an isolated restore drill before treating backups as a
production recovery control.

`systemd/apple333-backup.service` and `.timer` are uninstalled templates. Do
not enable them until the exact account, protected external environment file,
destination mount, notification route, one-shot backup, and restore drill have
been reviewed. The complete procedure is in
[the Phase 01 backup guide](../docs/phase-01/05-backup-guide.md).

Prometheus/Grafana are an optional private Compose profile, not evidence of
working dashboards or alert delivery. Use the
[monitoring guide](../docs/phase-01/04-monitoring-guide.md) for the
ownership-aware operator procedure. GitHub deployment workflows likewise need
protected branches, Environments/reviewers, isolated runners, and protected
server environment files; see the
[CI/CD operations runbook](../docs/phase-01/ci-cd-operations.md).

## Removal

```bash
# Stop/remove Apple333 containers and network; retain data and configuration.
bash deploy/bin/uninstall.sh --apply

# Create an encrypted backup, then remove only verified PostgreSQL/Redis volumes.
bash deploy/bin/uninstall.sh --apply --purge-owned-data
```

The purge command requires a typed confirmation. It retains the source
checkout, `.env.production`, encrypted backup files, and MinIO object-storage
volume because object deletion needs its own approved backup/purge plan. It
never calls `docker system prune`, `docker compose down -v`, `prisma migrate
reset`, or `DROP DATABASE`.

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
