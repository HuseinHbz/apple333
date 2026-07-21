# Deployment maintenance rule

Every project change must review `deploy/` before it is committed or released.

Update this folder whenever a change affects any of the following:

- environment variables, secrets, domains, ports, or reverse-proxy behavior;
- Docker image/build/runtime, Node or package-manager version, services, queues,
  storage, logging, or health/readiness endpoints;
- PM2 ecosystem/runtime configuration, standalone build copying, process boot
  persistence, deployment account, protected root `.env.production`, logs, or
  bare-metal nginx/TLS configuration;
- Prisma schema, migrations, database bootstrap/backups, or data retention;
- release gates, database-adoption authority, or migration approval status;
- install, update, rollback, monitoring, or uninstall behavior.

If a change has no deployment impact, record that conclusion in its PR or
release notes after reviewing this folder. Do not silently assume deployment
assets remain correct.
