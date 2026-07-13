# Phase 01 rollback plan

## Principle

Rollback is a controlled recovery decision, not a blind reversal command.
Application rollback and database rollback are separate because a migration may
not be reversible or compatible with earlier code. Apple333's deployment
scripts deliberately preserve data and do not auto-restore a database.

## Preconditions for every release

- Immutable release commit/tag and previous known-good release recorded.
- Explicit migration decision: `--skip-migrations` or `--apply-migrations`.
- Preflight ownership result and environment identity recorded.
- Compatible backup ID and restore owner identified before any migration.
- Staging validation, health/readiness result, and public TLS check attached.
- Rollback commander, business approver, and communication channel named.

## Decision matrix

| Situation | First response | Safe rollback path |
| --- | --- | --- |
| App failure, no schema change | Preserve logs and verify scope. | Redeploy previous reviewed application revision with `update.sh --apply --skip-migrations`, then validate readiness. |
| Bad environment/configuration change | Revert only the reviewed environment value from protected backup; do not change ownership identity fields. | Run preflight, apply compatible previous configuration/release, validate health and public routing. |
| Failed migration | Stop and preserve database, containers, logs, and backup. | Do not auto-revert. Assess forward fix vs. restore into isolated target with DBA/owner approval. |
| Data corruption/deletion | Contain writes and declare an incident. | Restore a verified backup into a new isolated target, validate compatible release, then approve cutover. |
| TLS/proxy failure | Keep database untouched; inspect the dedicated Apple333 virtual host/edge configuration. | Restore the prior approved proxy configuration, validate headers/routing, then monitor. |
| Foreign resource detected | Stop immediately. | Choose a new isolated target or obtain separate owner-approved cleanup; never force adoption/deletion. |

## Application-only rollback

Use only when the release made no database change and the prior application is
schema-compatible:

```bash
cd /opt/apple333
git checkout <previous-reviewed-commit-or-tag>
bash deploy/bin/preflight.sh
bash deploy/bin/update.sh --apply --skip-migrations
bash deploy/bin/status.sh
```

Then validate the loopback health/readiness endpoints, public HTTPS routing,
browser smoke flows, logs, and error monitoring. Record timestamps, revision,
operator, and observed result.

## Migration incident response

1. Do not rerun migrations blindly and do not use `prisma db push`, reset, or
   unreviewed SQL to make the error disappear.
2. Preserve the failed migration logs and identify the exact migration/release.
3. Verify the backup made before the migration and its checksum.
4. Decide, with the data owner and technical lead, whether a reviewed forward
   corrective migration is safer than recovery.
5. If restoration is approved, restore to a new isolated database/schema,
   validate the matching application release, and only then plan traffic cutover.
6. Complete a post-incident review and update migration, backup, and deployment
   documentation before the next release.

## Rollback prohibitions

- Do not use `docker system prune`, `docker compose down -v`, blanket recursive
  deletion, `prisma migrate reset`, or `prisma db push` as a rollback method.
- Do not restore data into a foreign/shared database or unknown schema.
- Do not edit deployment state markers, Compose project names, environment
  identity, or install IDs to make preflight pass.
- Do not purge data during an incident unless separately authorized after a
  verified backup.

## Exit criteria

An incident rollback is complete only when the incident owner records the
chosen recovery point, deployed revision, migration/database state, health and
readiness status, public TLS result, error/latency observation period, data-loss
assessment, and follow-up actions. Update `deploy/` whenever the recovery or
deployment procedure changes.
