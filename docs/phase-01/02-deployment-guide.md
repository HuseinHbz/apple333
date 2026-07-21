# Phase 01 deployment guide

## Rule of use

[`deploy/`](../../deploy/README.md) is the only supported managed-server
deployment entry point. Read its
[safety policy](../../deploy/SAFETY-POLICY.md) before mutating a server. Do not
substitute ad-hoc `docker compose`, `prisma db push`, seed, reset, or volume
removal commands for the managed workflow.

This guide describes the safe sequence. It is not evidence that Docker has run
or that a target server is ready.

## Preflight prerequisites

- A dedicated Linux host with Docker Engine, Docker Compose v2, Bash, `curl`,
  `flock`, `openssl`, `realpath`, and `age` for encrypted backup operations.
- A dedicated `/opt/apple333` checkout and `/var/lib/apple333` state/backup
  location owned by the deployment operator.
- An approved external TLS proxy/load balancer forwarding only to the
  loopback-bound Apple333 nginx port.
- A unique environment identity: Compose project, install root, state path,
  database, PostgreSQL schema, volumes, secrets, and hostname.
- Approved secrets in an authorized secret manager. Never put real secrets in
  Git, CI logs, an issue, or a chat transcript.

## Configure an environment

```bash
cd /opt/apple333
cp deploy/.env.production.example deploy/.env.production
chmod 600 deploy/.env.production
# Edit the copy using the approved secret-management workflow.
```

Set all required application, authentication, database, and ownership fields.
Keep `APPLE333_INSTALL_ID` blank for the first installation: the script creates
it only after checks pass. Use a dedicated non-`public` PostgreSQL schema. Do
not alter `COMPOSE_PROJECT_NAME`, `APPLE333_ENVIRONMENT`, install root,
database/schema identity, or an existing install ID in place; those values are
ownership evidence, not casual settings.

The default managed-server path is `deploy/.env.production`. A self-hosted CI
runner may instead supply the same protected file outside the checkout by
setting `APPLE333_ENV_FILE` to an absolute path. That file must remain outside
Git, use mode `0600`, be readable only by the reviewed deployment account, and
contain the exact environment identity expected by the target server. See the
[CI/CD operations runbook](ci-cd-operations.md) before configuring a runner.

## Inspect before any change

```bash
bash deploy/bin/preflight.sh
```

Preflight is read-only. It checks the deployment state file, labelled Docker
resources, database ownership marker, source path, environment, and configured
host port. If it reports `FOREIGN`, `OWNED_OTHER_APPLE333`, `AMBIGUOUS`,
`UNREACHABLE`, or an occupied port, stop. Pick a new isolated target or follow
a separately approved cleanup/adoption procedure. Do not delete a resource
because its name looks familiar.

## First installation gate

```bash
# Only after preflight succeeds and the release has reviewed Prisma migrations:
bash deploy/bin/install.sh --apply
```

At the present repository state, this command intentionally stops because there
is no reviewed `prisma/migrations/` bundle. This is correct behavior: it
prevents inferred schema creation and never falls back to `prisma db push` or
`migrate reset`.

Once a reviewed migration bundle exists, the script first builds the exact
release's app and dedicated one-shot migration images, then runs Prisma only in
that non-root migration image before it starts the matching app image. Do not
replace this with an ad-hoc shell in the public runtime container.

Before first installation can proceed, create and approve an additive baseline
migration, review the generated SQL, provide a backup/recovery plan, and prove
the migration on staging. Then re-run preflight and installation with the exact
reviewed release revision.

## Update a verified deployment

```bash
cd /opt/apple333
git fetch origin
git checkout <reviewed-commit-or-tag>
bash deploy/bin/preflight.sh

# Release deliberately reviewed as schema-compatible with no migration:
bash deploy/bin/update.sh --apply --skip-migrations

# Release with an approved, compatible Prisma migration:
bash deploy/bin/update.sh --apply --apply-migrations
```

The migration option is mandatory. With `--apply-migrations`, the script first
creates a PostgreSQL backup, checks migration status, and applies reviewed
migrations. A failed update preserves the data and signals investigation; it
does not automatically restore a database because that operation can be unsafe.

## Validate and monitor

```bash
bash deploy/bin/status.sh
curl -fsS http://127.0.0.1:8080/api/health
curl -fsS http://127.0.0.1:8080/api/ready
```

Check the public HTTPS origin separately through the approved TLS edge. Record
the exact release revision, migration decision, preflight result, backup ID (if
applicable), health/readiness output, and any rollback decision in the release
log.

## Configuration changes

1. Back up the current protected environment file in the secret manager.
2. Change only `deploy/.env.production` through the approved workflow.
3. Run preflight and explicitly choose the migration behavior for the update.
4. Validate health, readiness, routing, logs, and monitoring after deployment.

Changing a domain, secret, storage setting, port, or database credential can
change runtime behavior. Updating an ownership identity field is a migration to
a different deployment, not an in-place edit.

## Stop, uninstall, and purge

```bash
# Stops/removes verified service containers and network only; retains data.
bash deploy/bin/uninstall.sh --apply

# Creates a backup and asks for an exact typed confirmation before removing only
# verified Apple333 PostgreSQL/Redis volumes.
bash deploy/bin/uninstall.sh --apply --purge-owned-data
```

Never use `docker system prune`, `docker compose down -v`, blanket recursive
deletion, or database reset commands as an Apple333 deployment shortcut.

## CI/CD deployment handoff

The repository contains quality, security, staging, and manual-production
workflow definitions, but GitHub Environments, required reviewers, protected
branches, deployment runners, repository variables, and protected server
environment files are not configured by repository files alone. Follow
[CI/CD operations runbook](ci-cd-operations.md) before enabling a staging or
production workflow. Production remains a manual, Environment-approved action;
it must not be made push-triggered.

## Bare-metal PM2 lane

The host-managed nginx + PM2 deployment is now a documented lane in
[`deploy/`](../../deploy/README.md). It is separate from the ownership-aware
Docker Compose workflow, not a replacement for its data-safety rules. Never
run PM2 and the Docker `app` service on the same host/port.

Use the root deployment scripts for a reviewed bare-metal host:

```bash
cd /var/www/apple333
cp .env.production.example .env.production
chmod 600 .env.production
# Set all secrets and APPLE333_DEPLOY_BRANCH through the approved workflow.
./deploy/environment-check.sh
./deploy/install.sh
./deploy/health-check.sh

# Routine code-only release:
./deploy/update.sh
```

PM2 runs [`ecosystem.config.js`](../../ecosystem.config.js), which starts the
Next standalone server rather than `next start`. The deployment script copies
static assets into the standalone artifact, loads the protected environment
without shell-sourcing it, uses `pm2 startOrReload --env production
--update-env`, saves PM2 state, and verifies loopback `/api/health` plus
`/api/ready`. It stages a build before swapping `.next` and performs only an
application/build rollback on failure. The Phase 04.1 PIM migration remains
production-blocked; the PM2 lane does not run Prisma migrations or database
rollback.

## Handoff checklist

- [ ] `deploy/` reviewed under the maintenance rule.
- [ ] All target resources are proven `OWNED_CURRENT` or fresh and isolated.
- [ ] The release's migration decision, SQL review, and backup compatibility are recorded.
- [ ] TLS edge, headers, health, readiness, logs, and alerts are verified.
- [ ] Backup and rollback references are attached to the release.
