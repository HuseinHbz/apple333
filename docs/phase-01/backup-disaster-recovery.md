# Phase 01 backup and disaster recovery architecture

## Scope and current safety baseline

Apple333's primary recoverable state is PostgreSQL. Redis persistence is useful
for operational continuity but is not a replacement for the PostgreSQL backup.
The managed `deploy/bin/` update and purge paths create an encrypted PostgreSQL
custom-format backup before a migration or an explicitly confirmed data purge.
The repository also supplies an opt-in `scripts/backup-db.sh` helper and
uninstalled systemd service/timer templates for a daily schedule. None of those
templates is configured or enabled by default, and no production execution
evidence exists here.

The helper copies to a separately configured path and verifies the checksum,
but code cannot prove that path is truly off-host/offsite or in a separate
failure domain. That property, alerting, retention lifecycle, and restore
validation are operator-owned release gates. No automatic restore is provided.

This is intentional documentation of the current state, not evidence that a
backup or recovery has already been tested. The missing operational controls
below are production release gates.

## Recovery objectives

| Objective | Initial target | Owner must confirm |
| --- | --- | --- |
| RPO (maximum data loss) | 24 hours until a tighter, tested schedule is approved | Business owner and data owner |
| RTO (time to restore service) | 4 hours until a measured restoration drill exists | Operations owner |
| Backup frequency | Daily full PostgreSQL backup; additionally before every schema migration or destructive operation | Operations owner |
| Retention | 35 daily, 12 monthly, and 12 annual backups as an initial target policy | Legal, finance, and data-retention owner |
| Restore test | At least quarterly and after meaningful database-version or backup-process changes | Incident commander / DBA |

Targets become enforceable only when the accountable owners approve them and a
successful drill records the measured result.

## Backup design

1. Run the daily PostgreSQL backup from a restricted service account on the
   server or through an approved backup platform.
2. Use `pg_dump` custom format, encrypted into a `.dump.age` artifact. Decrypt
   it with the approved age identity before using `pg_restore --list` or
   `pg_restore`; do not pass the encrypted artifact directly to `pg_restore`.
3. Store the initial artifact in `APPLE333_BACKUP_DIR`, then copy it to a
   separately configured access-controlled destination. Independently verify
   that the destination is genuinely off-host/offsite; a distinct local path
   is not sufficient evidence.
4. Encrypt backups in transit and at rest. Manage encryption keys separately
   from the backup storage account and rotate access credentials.
5. Record checksum, timestamp, PostgreSQL version, application release/tag,
   database/schema identity, retention expiry, and backup job result in the
   approved operations log.
6. Alert on a missing, failed, undersized, or unverifiable backup. Never expose
   backup paths, database URLs, passwords, or secrets in public CI output.

The repository includes `scripts/backup-db.sh`, `scripts/restore-db-drill.sh`,
and a systemd timer template. They require explicit operator configuration and
have not been executed against a staging server in this repository context.
Scheduled backup, true offsite replication, retention lifecycle, alerting, and
restore-drill evidence remain release blockers.

## Ownership and isolation safeguards

Only a database proven to belong to the current Apple333 deployment may be
backed up or restored through the managed workflow. The proof consists of the
state marker, Docker ownership labels, and the PostgreSQL deployment metadata
marker described in [`deploy/SAFETY-POLICY.md`](../../deploy/SAFETY-POLICY.md).

Never restore into a shared database, an unknown schema, or a target owned by a
different Apple333 environment. A matching name is not proof of ownership.

## Backup verification procedure

For each daily backup:

1. Confirm the job used the intended production database and dedicated schema.
2. Confirm the output file is non-empty, protected from general users, and has
   completed transfer to the configured secondary destination. Separately
   confirm and record that its host/mount/storage failure domain is independent.
3. Decrypt before inspecting the custom-format archive:

   ```bash
   age -d -i "$APPLE333_BACKUP_AGE_IDENTITY_FILE" /path/to/backup.dump.age \
     | pg_restore --list >/dev/null
   ```

   Record only the outcome, not encryption identities, database URLs, or
   sensitive object names.
4. Verify the checksum after transfer.
5. Record success or failure and alert the on-call operator on failure.

For a quarterly restore drill, provision a new isolated recovery database and
schema, restore a selected backup, run the matching application release against
it in a non-public environment, and verify `/api/health`, `/api/ready`, core
authentication, and a representative catalog read. Destroy the recovery target
only under its own approved cleanup procedure.

## Disaster recovery runbook

1. **Declare and contain.** Open an incident, identify the affected environment,
   disable unsafe writes if needed, and preserve logs, containers, and volumes.
2. **Classify the event.** Distinguish application failure, bad configuration,
   accidental deletion, database corruption, credential compromise, and host
   loss. Do not run an install or migration retry merely because readiness fails.
3. **Select recovery point.** Choose a checksum-verified backup whose timestamp
   meets the approved RPO. Confirm its application/migration compatibility.
4. **Create an isolated target.** Verify ownership and ensure no foreign/shared
   schema is touched. Do not use `public` as a shortcut for a shared database.
5. **Restore manually under approval.** Use PostgreSQL tooling with a reviewed
   command plan; the deployment scripts deliberately do not auto-restore.
6. **Validate before cutover.** Run database checks, the application health and
   readiness endpoints, selected business smoke tests, security/header checks,
   and log inspection.
7. **Cut over and monitor.** Switch traffic only after an incident owner
   approves. Monitor errors, response time, database health, and data integrity.
8. **Close and improve.** Document actual RPO/RTO, root cause, data loss, and
   corrective work. Update `deploy/` if deployment behavior changed.

## Database migration rule

The repository currently has no reviewed Prisma migration bundle in
`prisma/migrations/`. The install script blocks database initialization instead
of inferring a schema or invoking `prisma db push`. Before any production
database operation, create and approve an additive baseline migration, SQL
review, backup evidence, compatibility assessment, and rollback/recovery plan.

## Open production gates

- A reviewed, least-privilege daily scheduler configured from the template and
  verified with an actual one-shot run.
- Off-host/offsite encrypted storage with independent failure-domain evidence.
- Automation for the approved monthly/annual retention tiers; current code
  only prunes daily artifacts by age.
- Alerting on backup failure and capacity.
- A successful documented restore drill.
- Owner-approved RPO/RTO appropriate to the business.
