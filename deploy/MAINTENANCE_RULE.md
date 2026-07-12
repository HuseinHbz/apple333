# Deployment maintenance rule

Every project change must review `deploy/` before it is committed or released.

Update this folder whenever a change affects any of the following:

- environment variables, secrets, domains, ports, or reverse-proxy behavior;
- Docker image/build/runtime, Node or package-manager version, services, queues,
  storage, logging, or health/readiness endpoints;
- Prisma schema, migrations, database bootstrap/backups, or data retention;
- install, update, rollback, monitoring, or uninstall behavior.

If a change has no deployment impact, record that conclusion in its PR or
release notes after reviewing this folder. Do not silently assume deployment
assets remain correct.
