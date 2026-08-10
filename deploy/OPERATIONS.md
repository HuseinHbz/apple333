# Apple333 deployment operations

## Select the correct deployment lane

The Docker Compose scripts in `deploy/bin/` and the root PM2 scripts are
separate operational lanes. Do not mix their environment files or run both
application processes on port `3000`.

The current host has nginx proxying to a bare-metal PM2 application, so use:

```bash
cd /var/www/apple333
./deploy/environment-check.sh
./deploy/update.sh
./deploy/health-check.sh
```

The PM2 updater is intentionally code-only while the Phase 04.1 PIM baseline
is production-blocked. It validates the database connection without migration,
uses `node .next/standalone/server.js`, reloads with the production PM2
environment, and rolls back only application files/builds on failure.

PM2 must be installed for the same deployment user that runs the scripts. After
the first healthy start, enable boot persistence once and retain the process
list:

```bash
pm2 startup systemd -u "$(id -un)" --hp "$HOME"
pm2 save
```

## Before every action

```bash
cd /opt/apple333
bash deploy/bin/preflight.sh
```

Review ownership, port, and database status. Treat `FOREIGN`,
`OWNED_OTHER_APPLE333`, and `UNREACHABLE` as stop conditions.

The current Phase 04.1 PIM baseline is also a stop condition for fresh server
installation and migration-bearing updates. It is a CI/test-only initial
schema, not a production approval. It cannot be enabled with an environment
variable; see [RELEASE-GATES.md](RELEASE-GATES.md).

## Environment changes

After changing a domain, port, secret, S3 setting, PostgreSQL credential, or
other `deploy/.env.production` value:

1. validate the change with preflight;
2. choose a migration decision explicitly; and
3. run `update.sh --apply --skip-migrations` only when schema compatibility was
   reviewed, otherwise use `--apply-migrations`.

Changing `COMPOSE_PROJECT_NAME`, `APPLE333_ENVIRONMENT`,
`APPLE333_INSTALL_ROOT`, database name/schema, or `APPLE333_INSTALL_ID` on an
existing installation changes ownership identity. Do not make those edits in
place; provision a new isolated deployment or follow a reviewed migration plan.

## Backup and restore

`update.sh --apply --apply-migrations` and data purge create encrypted
custom-format PostgreSQL backups under `APPLE333_BACKUP_DIR`. They require the
protected `APPLE333_BACKUP_AGE_RECIPIENT` configuration.

Run a safe periodic backup and an isolated restore drill:

```bash
bash scripts/backup-db.sh --apply --prune-retention
bash scripts/restore-db-drill.sh --apply --backup /var/lib/apple333/backups/<file>.dump.age
```

The restore drill creates a labelled ephemeral PostgreSQL target only; it never
targets the live database or a persistent volume. Production recovery remains a
separately approved incident procedure. Never restore into a shared/foreign
schema.

## Reverse proxy and TLS

The bundled nginx binds to loopback by default on port `8080`. Place a managed
TLS proxy (for example, an existing organization-approved nginx, Caddy, or load
balancer) in front of it. Do not overwrite an existing virtual host or
certificate configuration; configure a new Apple333 hostname explicitly.

For the bare-metal PM2 lane, use
[`nginx.bare-metal.conf.template`](nginx.bare-metal.conf.template) as the
reviewed starting point. It terminates TLS, redirects HTTP and `www` to the
canonical domain, and proxies only to `127.0.0.1:3000` with `Host`,
`X-Forwarded-For`, and `X-Forwarded-Proto` headers. Validate before reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo certbot renew --dry-run
```

## Troubleshooting

| Symptom | Safe first action |
| --- | --- |
| HTTP port occupied | Choose another Apple333 port or update the existing proxy; never kill the unknown process automatically. |
| Database marker missing | Stop. Confirm whether the schema is empty, legacy Apple333, or foreign before any action. |
| `ready` returns 503 | Inspect `docker compose ... logs app postgres`; check `.env.production` and database credentials. |
| PM2 health/readiness fails | Run `pm2 status`, inspect `/var/log/apple333/app.error.log`, and run `./deploy/health-check.sh`. Do not switch back to `next start`; verify `.next/standalone/server.js` exists. |
| PM2 process disappears after reboot | Run the documented `pm2 startup ...` command for the deployment user, then `pm2 save`; do not create an ad-hoc service that races PM2. |
| Bare-metal update fails | Preserve the named `/var/backups/apple333/<snapshot>` directory. The updater attempts application-only rollback; inspect with `./deploy/rollback.sh` before an explicit `--apply`. |
| `ready` reports Redis unavailable | Check the private Redis container, `REDIS_PASSWORD`, and the authenticated `REDIS_URL`; do not expose or replace Redis blindly. |
| Backup refuses to run | Verify age recipient, off-host path, permissions, and current ownership; do not use an unencrypted ad-hoc dump as a substitute. |
| Update fails after migration | Keep services/data, inspect the backup and migration logs, then perform a reviewed recovery. |
| State marker mismatch | Do not edit it manually. Treat the deployment as another/legacy environment until ownership is proven. |
| Database marker reports `RECOVERY_REQUIRED` | Stop. Preserve the data and logs; do not rerun install. Review the failed/unfinished migration and recovery plan before any manual action. |
| Required data volume missing | Stop. Do not run update to recreate PostgreSQL, Redis, or MinIO; investigate the host/volume and use a reviewed restore if needed. |
