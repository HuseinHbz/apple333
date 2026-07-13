# Phase 01 monitoring guide

## Objective

Monitoring must make failures actionable without leaking customer data or
secrets. It should cover availability, latency, application errors, database
health, Redis health, host capacity, deployment state, and backup status.

This document separates observed code-level foundations from required production
operations. Installation of a package is not proof that telemetry is collected
or alerting is configured.

## Current foundations

| Signal | Repository evidence | Limit / action |
| --- | --- | --- |
| Liveness | `GET /api/health` returns an application `ok` response. | It does not prove database or Redis availability. |
| Readiness | `GET /api/ready` parses environment, queries PostgreSQL, and sends a real Redis `PING`. | It is a traffic gate, not proof that staging services have run. |
| App logs | `src/server/logging/logger.ts` emits JSON with selected sensitive keys filtered. | Configure collection, access control, retention, and broader field-redaction review. |
| Error SDK | Client/server/edge Sentry initialization is versioned and avoids default PII capture; server and edge events explicitly remove request payloads, cookies, query strings, environment data, and sensitive headers before sending. App error boundaries capture exceptions. | Configure DSN, release/source-map handling, alert ownership, and real capture evidence. |
| Metrics | `/api/metrics` refreshes dependency gauges; Prometheus/Grafana/alert configs are in `deploy/monitoring/`. | The route is disabled unless `METRICS_ENABLED=true`, blocked by public nginx, and intended only for the private monitoring profile; verify runtime dashboards/alerts. |

## Current coverage boundary

The repository-level metrics foundation currently exposes readiness/dependency
signals and default Node process metrics. It does **not** by itself provide
per-route request rate/p50/p95/p99/5xx metrics, PostgreSQL connection/disk/query
metrics, Redis memory/eviction/persistence metrics, nginx metrics, backup-age,
certificate-expiry, log aggregation, or an alert receiver. Those signals need
reviewed exporters/instrumentation and a production monitoring design before
they can be shown on a dashboard or used for an alert.

The versioned Prometheus rules are only rule definitions. Alert delivery is not
complete until an approved Alertmanager or equivalent receiver, routing policy,
on-call owner, and successful test notification are configured outside the
repository.

## Start the private observability profile

The optional `observability` Compose profile contains private Prometheus and
loopback-bound Grafana services. It is an operator action for an already
ownership-proven deployment; it does not replace `install.sh` or `update.sh`.
Never expose Grafana, Prometheus, or `/api/metrics` directly to the public
internet.

Before enabling it, the operator must:

1. complete an ownership-aware preflight against the intended environment;
2. set non-placeholder `GRAFANA_ADMIN_*` values and the approved Prometheus
   retention value in the protected environment file;
3. decide who can access the loopback Grafana port through a VPN, bastion, or
   authenticated administrative proxy;
4. configure an approved alert receiver and dashboard ownership; and
5. record that Prometheus reaches the app only over the private Docker network.

For a verified existing deployment, use an explicit protected environment-file
path rather than copying secrets into a shell command:

```bash
export APPLE333_ENV_FILE=/etc/apple333/staging.env
bash deploy/bin/preflight.sh --assert-owned
docker compose --env-file "$APPLE333_ENV_FILE" \
  -f deploy/compose.production.yml --profile observability \
  up -d prometheus grafana
docker compose --env-file "$APPLE333_ENV_FILE" \
  -f deploy/compose.production.yml --profile observability ps
```

The preceding commands are an operator procedure, not execution evidence in
this document. If preflight reports foreign, ambiguous, or mismatched resources,
stop rather than using Compose to force adoption. Record the exact command
output in the release evidence after it is run.

Grafana's published port is loopback-only by default. Access it only through an
approved administrative path; do not change the host bind to `0.0.0.0` as a
shortcut. Prometheus has no public host-port mapping and scrapes `app:3000`
inside the private network. Nginx intentionally returns `404` for public
`/api/metrics` requests.

## Operator validation and handoff

After the profile is configured, collect evidence for all of the following:

- Prometheus target status for the application scrape and the expected
  readiness/dependency metrics;
- Grafana datasource health, administrator access over the approved path, and
  dashboard ownership;
- Sentry event capture with `sendDefaultPii` behavior and sanitized payloads;
- alert receiver routing, escalation owner, and a controlled test alert;
- log collection, redaction review, retention, and incident-search access; and
- the explicitly missing exporter/instrumentation coverage listed above, or an
  approved plan with an owner and due date.

Do not treat a running container, an open Grafana page, or a committed alert
rule as proof that notifications, dashboards, or capacity signals work.

## Required observability architecture

```text
Apple333 app / nginx / PostgreSQL / Redis / host
  -> structured logs and metrics collectors
  -> restricted monitoring platform
  -> dashboards, retention, alert rules
  -> on-call notification and incident record
```

Keep monitoring traffic and credentials private. A public metrics endpoint is
not an acceptable default. If Prometheus scraping is introduced, restrict it to
the observability network and protect it with network policy/authentication.

## Minimum dashboards

| Dashboard | Required signals |
| --- | --- |
| Service health | `/api/health` and `/api/ready` status, deployment version, restarts, HTTP 5xx rate. |
| Request performance | Request rate, p50/p95/p99 response time, route error rate, upstream latency. |
| Application errors | Sentry/error event count, release correlation, affected route, sanitized request ID. |
| PostgreSQL | Reachability, connection saturation, query latency, disk growth, backup age, replication if used. |
| Redis | Reachability, memory, eviction, persistence status, client errors; defer application-specific cache hit rate until adapter exists. |
| Host/container | CPU, memory, disk, filesystem inode usage, container restarts, image/resource capacity. |
| Security/operations | Failed administrative access, certificate expiry, backup failure, unusual deployment attempts. |

## Minimum alerts

Set thresholds from observed staging and production baselines. Initial alerts
should include:

- public health or readiness failing for a sustained window;
- elevated 5xx rate or sustained p95 latency regression;
- unhandled application error spike;
- PostgreSQL unavailable, disk near capacity, or connection saturation;
- Redis unavailable if/when it becomes a required runtime adapter;
- backup older than the approved RPO or a failed backup/restore verification;
- certificate expiration warning;
- repeated container restart or deployment failure.

Every alert needs severity, service owner, on-call destination, runbook URL,
deduplication behavior, and an escalation path. Alerting without an accountable
recipient is incomplete.

## Logging policy

Use the structured logger or a compatible structured format with UTC timestamps,
level, request ID, route/method, sanitized actor identifier, duration, and
error code. Do not log raw authentication material, passwords, OTPs, cookies,
authorization headers, national codes, card numbers, database URLs, or secrets.

Restrict query permissions, encrypt log storage, define retention by data
classification, and test an incident search workflow. Verify that proxy logs do
not capture query strings or headers containing credentials.

## Release validation

On staging, for the exact release:

1. generate a controlled application error and verify it reaches the approved
   error tracker with no secrets;
2. verify a health/readiness failure produces the expected alert;
3. confirm database and Redis availability signals (or document Redis as
   non-critical until the adapter is implemented);
4. verify logs correlate a sanitized request ID across the proxy/application;
5. validate dashboard data freshness and alert routing; and
6. record the results in release evidence.

Until these checks run, monitoring status is **foundation present, production
verification pending**.
