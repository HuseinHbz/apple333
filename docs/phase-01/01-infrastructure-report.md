# Phase 01 infrastructure baseline report

**Report purpose:** repository-state assessment for infrastructure hardening.
This is not a completion certificate and does not substitute for runtime
evidence.

## Executive summary

Apple333 has a TypeScript/Next.js application, pnpm lockfile, PostgreSQL Prisma
schema, basic GitHub Actions quality workflow, liveness/readiness endpoints,
structured logger, and a safety-focused managed deployment bundle under
[`deploy/`](../../deploy/README.md). The deployment bundle is the canonical
operational entry point and includes ownership checks before resource reuse or
removal.

The platform is not yet demonstrably production-ready from repository evidence
alone. The most important release blockers are: no reviewed Prisma migration
bundle, no runtime Docker validation evidence, no verified automated backup/
restore process, no evidenced external TLS configuration, and no verified
monitoring/alerting deployment.

## Observed implementation

| Area | Evidence | Assessment |
| --- | --- | --- |
| Application | Next.js 15, React 19, TypeScript strict mode, `pnpm` specified in `package.json`. | Foundation present. |
| Database | Prisma PostgreSQL schema exists in `prisma/schema.prisma`. | Schema exists, but `prisma/migrations/` is absent. |
| Local dependencies | Root `docker-compose.yml` provides PostgreSQL and Redis for local use. | Not a production deployment definition. |
| Managed deployment | `deploy/compose.production.yml`, configuration template, preflight/install/update/status/uninstall scripts, safety policy. | Safety design present; requires host/runtime validation. |
| Resource ownership | State marker, Docker labels, and PostgreSQL metadata marker are checked by deployment scripts. | Strong safety guard against reuse/deletion of unknown resources. |
| Health | `/api/health` is liveness; `/api/ready` validates configuration, PostgreSQL `SELECT 1`, and an authenticated Redis `PING`. | Route behavior is unit/integration-tested; live service evidence is still required. |
| CI/CD | Quality, staging, manual-production, dependency/secret scan, CodeQL, and Dependabot definitions are present. | Repository configuration and self-hosted runner/environment approval must be verified outside Git. |
| Logging | JSON structured logger redacts selected sensitive context keys. | Log transport, retention, querying, and alerting need operational verification. |
| Observability | Sentry client/server/edge initialization, an opt-in private `/api/metrics`, Prometheus alerts, and Grafana provisioning are present. | Sentry DSN, dashboards, alert receivers, log aggregation, and runtime scrape evidence remain operator-owned release gates. |
| Runtime images | `docker/Dockerfile.production` has separate non-root app and one-shot migration targets; canonical Compose includes resource limits and health checks. | Docker build/Compose execution evidence is still required. |

## Hard safety constraints

- The deployment scripts must not run `prisma db push`, `prisma migrate reset`,
  `docker system prune`, or `docker compose down -v`.
- Unknown, foreign, or ambiguous Docker/database resources are not reused or
  deleted automatically.
- Default uninstall preserves persistent data; purge requires backup plus typed
  confirmation.
- The canonical production environment uses a dedicated non-`public` PostgreSQL
  schema and validator-enforced loopback-bound nginx.
- The metrics route is disabled unless the managed private Compose stack opts
  in, and the unrelated-resource tool refuses Apple333-labelled resources.

See [`deploy/SAFETY-POLICY.md`](../../deploy/SAFETY-POLICY.md) for the
authoritative behavior.

## Production gaps and required evidence

| Priority | Gap | Required closure evidence |
| --- | --- | --- |
| Critical | No reviewed Prisma migrations | Approved additive migration bundle, SQL review, backup/restore compatibility plan, and staging migration result. |
| Critical | Docker image/Compose behavior not executed in this assessment | Successful staging `docker compose config`, build, service health, `/api/health`, and `/api/ready` records. |
| Critical | No daily backup/restore evidence | Automated encrypted backup with a separately proven off-host/offsite destination, retention policy, alert, and successful restore drill. |
| High | No external TLS edge evidence | Dedicated hostname, certificate renewal, redirect, headers, and staging validation. |
| High | Monitoring requires production wiring | Configure Sentry DSN/release tagging, Grafana access, alert receivers, log retention, and capture actual scrape/alert evidence. |
| High | Deployment workflow requires repository/server configuration | Configure protected branches, GitHub Environments/reviewers, self-hosted runners, deployment paths, and protected env files. |
| Medium | Redis/minio runtime evidence is absent | Exercise authenticated Redis readiness and MinIO health in staging; MinIO must not activate application storage until its adapter is approved. |
| Medium | Container hardening is unexecuted | Verify reproducible multi-stage build, non-root runtime, resource limits, and image scan on staging. |

## Recommended execution order

1. Establish the reviewed baseline Prisma migration and a database-change
   report; do not bypass the deployment guard.
2. Validate the production Compose stack and hardened image in staging.
3. Implement and test daily backup, independently verified off-host/offsite
   retention, and restore recovery.
4. Configure the external TLS proxy, monitoring, alerting, and log retention.
5. Add a staged CI/CD workflow with a manual production approval environment.
6. Produce completion evidence only after the preceding commands run on the
   target environment.

## Documentation set

- [Environment architecture](environment-architecture.md)
- [Nginx architecture](nginx-architecture.md)
- [Backup and disaster recovery](backup-disaster-recovery.md)
- [Deployment guide](02-deployment-guide.md)
- [CI/CD operations runbook](ci-cd-operations.md)
- [Security checklist](03-security-checklist.md)
- [Monitoring guide](04-monitoring-guide.md)
- [Backup guide](05-backup-guide.md)
- [Rollback plan](06-rollback-plan.md)
- [Completion and release-evidence report](07-phase-completion-report.md)
