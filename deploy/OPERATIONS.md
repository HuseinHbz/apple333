# Apple333 deployment operations

## Before every action

```bash
cd /opt/apple333
bash deploy/bin/preflight.sh
```

Review ownership, port, and database status. Treat `FOREIGN`,
`OWNED_OTHER_APPLE333`, and `UNREACHABLE` as stop conditions.

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

`update.sh --apply --apply-migrations` and data purge create custom-format
PostgreSQL backups under `APPLE333_BACKUP_DIR`.

To inspect a backup without restoring it:

```bash
pg_restore --list /var/lib/apple333/backups/<file>.dump
```

Restoration is intentionally manual. Stop the application, verify a compatible
release and target database, obtain approval, then use PostgreSQL tools under a
separate recovery runbook. Never restore into a shared/foreign schema.

## Reverse proxy and TLS

The bundled nginx binds to loopback by default on port `8080`. Place a managed
TLS proxy (for example, an existing organization-approved nginx, Caddy, or load
balancer) in front of it. Do not overwrite an existing virtual host or
certificate configuration; configure a new Apple333 hostname explicitly.

## Troubleshooting

| Symptom | Safe first action |
| --- | --- |
| HTTP port occupied | Choose another Apple333 port or update the existing proxy; never kill the unknown process automatically. |
| Database marker missing | Stop. Confirm whether the schema is empty, legacy Apple333, or foreign before any action. |
| `ready` returns 503 | Inspect `docker compose ... logs app postgres`; check `.env.production` and database credentials. |
| Update fails after migration | Keep services/data, inspect the backup and migration logs, then perform a reviewed recovery. |
| State marker mismatch | Do not edit it manually. Treat the deployment as another/legacy environment until ownership is proven. |
