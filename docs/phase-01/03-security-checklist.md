# Phase 01 security checklist

Use this checklist for staging and production release approval. A checked item
requires attached evidence, not an assertion. `deploy/` is canonical for
deployment ownership and destructive-operation safeguards.

## Secrets and environment

- [ ] Real `.env` files are excluded from Git and CI artifacts.
- [ ] Production and staging use unique `AUTH_SECRET`/`NEXTAUTH_SECRET` values
  of at least 32 random characters.
- [ ] Database, Redis, S3, and Sentry credentials are stored in the approved
  secret manager and have least-privilege access.
- [ ] Secret values, authorization headers, cookies, passwords, OTPs, national
  codes, and card numbers are absent from logs and support exports.
- [ ] Environment configuration is validated during readiness evaluation;
  malformed required origins and database URLs block readiness. Do not claim
  startup-time validation unless it is separately implemented and evidenced.
- [ ] Secret rotation owner, interval, and emergency rotation procedure are documented.

## Network and TLS

- [ ] Only HTTPS is exposed publicly; port 80 has an explicit redirect/ACME policy.
- [ ] PostgreSQL and Redis have no public host-port mapping.
- [ ] The internal Apple333 nginx bind remains loopback-only unless an approved
  network design explicitly changes it.
- [ ] Administrative access is restricted by named accounts, MFA, and an
  allowlist/VPN or equivalent boundary.
- [ ] TLS certificate issuance, renewal, cipher policy, and failure alerting are verified.
- [ ] Proxy trust configuration is reviewed before using client IP for security
  controls or audit records.

## Application and browser protections

- [ ] `NODE_ENV=production`; debug endpoints and development-only tooling are disabled.
- [ ] `X-Content-Type-Options`, framing policy, referrer policy, and permissions
  policy are validated at the public origin.
- [ ] A CSP report-only plan has been tested before enforcing a CSP.
- [ ] Cookies have secure, HTTP-only, same-site, domain, and expiry policies
  appropriate to the authentication implementation.
- [ ] Authentication, RBAC, tenant/branch authorization, and input validation
  tests pass for the release.
- [ ] Error responses do not disclose stack traces, database URLs, tokens, or
  internal network details.

## Database and deployment safety

- [ ] PostgreSQL database and non-`public` schema are dedicated to the target
  Apple333 environment.
- [ ] Preflight proves state marker, Docker labels, and database metadata marker
  match before an update, uninstall, or resource reuse.
- [ ] Foreign/ambiguous resources were not adopted or deleted without separate
  owner approval and an independent backup.
- [ ] A reviewed Prisma migration bundle exists for every database change.
- [ ] No release uses `prisma db push`, `prisma migrate reset`, automatic seed,
  `docker system prune`, or `docker compose down -v`.
- [ ] Backup, restore, retention, encryption, and rollback evidence is attached.

## Container and host hardening

- [ ] Image build is reproducible, pins/records base image provenance, and is
  scanned for actionable vulnerabilities.
- [ ] Runtime container uses a non-root user and contains only required runtime
  dependencies; attach build evidence rather than assuming it from a Dockerfile.
- [ ] Docker socket access is limited to the deployment operator.
- [ ] Host OS security updates, disk encryption policy, firewall, time sync,
  log retention, and vulnerability remediation owner are documented.
- [ ] Persistent volumes and backup directories have restrictive permissions.

## Supply chain and CI/CD

- [ ] `pnpm install --frozen-lockfile`, typecheck, lint, tests, build, and
  Prisma validation pass for the exact commit.
- [ ] Dependency scanning and secret scanning run in CI or an approved equivalent,
  with findings triaged.
- [ ] Staging deployment is traceable to an immutable commit/tag and has health
  evidence.
- [ ] Production deploy requires manual approval and cannot be triggered solely
  by a branch push.
- [ ] CI service credentials have minimum scopes and cannot print production secrets.

## Monitoring and incident response

- [ ] Liveness and readiness endpoints are checked without exposing sensitive
  internals.
- [ ] Error, latency, database, Redis, host-resource, backup, and certificate
  alerts route to an accountable on-call owner.
- [ ] Structured logs redact sensitive fields and have defined retention/access controls.
- [ ] An incident runbook, rollback plan, and recovery contacts are tested.

## Current known blockers

Do not mark this checklist complete solely from repository inspection. At the
time of writing, reviewed Prisma migrations, Docker runtime evidence, automated
daily backup/restore evidence, external TLS evidence, and fully deployed
monitoring/alerting evidence are not present in the repository.
