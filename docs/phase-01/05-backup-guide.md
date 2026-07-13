# Phase 01 backup operations guide

For the full architecture, recovery objectives, and disaster scenario workflow,
see [backup and disaster recovery](backup-disaster-recovery.md). This guide is
the operator-facing checklist.

## Non-negotiable rules

- Back up the exact dedicated Apple333 database/schema only after ownership is
  verified.
- Keep the database, backup destination, and encryption credentials separate
  from foreign/shared systems.
- Never test a restore against production in place.
- Never treat Redis persistence, a Docker volume, or a source checkout as a
  PostgreSQL backup.
- Do not expose backup files, database URLs, passwords, or encryption keys in
  logs, CI artifacts, chat, or Git.

## Existing managed behavior

The canonical deployment scripts create a PostgreSQL custom-format backup when:

- `deploy/bin/update.sh --apply --apply-migrations` runs; and
- `deploy/bin/uninstall.sh --apply --purge-owned-data` is explicitly requested.

`scripts/backup-db.sh --apply --prune-retention` adds the daily encrypted backup
path. It requires current ownership proof, an `age` recipient, checksum-verified
copy to a separately configured destination, and an explicit retention setting.
The script can prove that the two configured paths differ, but it **cannot**
prove that the second path is a separate host, mount, storage account, or
failure domain. The operator must verify and record that off-host/offsite
property before relying on it for recovery.

The provided systemd service and timer are uninstalled templates. They must be
reviewed for the actual host, operator account, mount, alert receiver, and
secret file before enabling them. No backup or restore drill has yet been
executed in this repository context.

## Daily backup checklist

1. Confirm the scheduled job runs under a restricted operator identity.
2. Run `bash scripts/backup-db.sh --apply --prune-retention` against the exact
   ownership-proven deployment.
3. Confirm the encrypted `.dump.age` artifact and checksum are in both the local
   protected backup directory and the configured secondary destination.
4. Independently prove that the secondary destination is off-host/offsite (for
   example, a separately managed storage account or a separately monitored
   mount) and record that evidence. A different pathname alone is insufficient.
5. Verify the transfer checksum and record timestamp, backup ID, release
   version, PostgreSQL version,
   retention date, and job result.
6. Alert the accountable operator on failure, missing backup, or capacity risk.

Run the isolated restore drill at least quarterly and after a material change to
PostgreSQL, the backup process, or encryption-key access; it is not a required
daily operation.

## Install and verify the systemd backup template

`deploy/systemd/apple333-backup.service` and
`deploy/systemd/apple333-backup.timer` are examples, not an installed service.
They contain site-specific defaults (`apple333-deploy`, `/opt/apple333`,
`/etc/apple333/production.env`, `/var/lib/apple333`, and
`/mnt/apple333-backups`) that must be reviewed before use.

1. Provision a dedicated non-login deployment account with only the Docker,
   checkout, state-directory, and backup-destination permissions it needs.
   Do not run the job as a broad administrator account.
2. Create the protected external environment file referenced by the service.
   It must contain the reviewed Apple333 deployment identity and backup values,
   be readable by the service account, and use mode `0600`. Keep it outside the
   Git checkout and never paste it into CI logs.
3. Confirm `APPLE333_BACKUP_OFFSITE_DIR` resolves to a destination with a
   separately verified failure domain. Update `ReadWritePaths` in a reviewed
   local copy of the service if the approved path differs from the template.
4. Have the infrastructure owner review the service user/group, paths, network
   mounts, `age` binary location, retention setting, journal retention, and
   failure-notification mechanism. The template has no alert receiver by
   itself.
5. Copy the reviewed local service and timer into `/etc/systemd/system/` with
   root-owned, non-writable unit permissions. For the template's default
   account/path choices, the installation form is:

   ```bash
   sudo install -o root -g root -m 0644 \
     deploy/systemd/apple333-backup.service /etc/systemd/system/apple333-backup.service
   sudo install -o root -g root -m 0644 \
     deploy/systemd/apple333-backup.timer /etc/systemd/system/apple333-backup.timer
   ```

   If the reviewed service differs from the repository template, install the
   reviewed local copy instead; do not overwrite the unit later with an
   unreviewed repository update. Then run:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl cat apple333-backup.service
   sudo systemctl start apple333-backup.service
   sudo systemctl status --no-pager apple333-backup.service
   ```

   Do not enable the timer until this one-shot job has produced a
   checksum-verified encrypted artifact in both destinations and an isolated
   restore drill has succeeded.
6. After the evidence is approved, enable and inspect the timer:

   ```bash
   sudo systemctl enable --now apple333-backup.timer
   sudo systemctl list-timers --all apple333-backup.timer
   ```

   Record the next scheduled run, last result, backup ID, and alert route in the
   release/operations log. To disable it safely, use
   `sudo systemctl disable --now apple333-backup.timer`; do not delete backup
   data as part of disabling a schedule.

## Before migration or purge

1. Run `bash deploy/bin/preflight.sh` and confirm current ownership.
2. Confirm a compatible backup exists and its restore procedure is known.
3. For migrations, use the explicit migration update command; it performs the
   managed backup before applying reviewed migrations.
4. For purge, use the managed uninstall command; it creates a backup and
   requires a typed confirmation.
5. Record the backup identifier in the change ticket/release log.

## Restore drill checklist

1. Select a checksum-verified backup.
2. Inspect the encrypted custom-format archive without disclosing its contents:

   ```bash
   age -d -i "$APPLE333_BACKUP_AGE_IDENTITY_FILE" /path/to/backup.dump.age \
     | pg_restore --list >/dev/null
   ```

   The `.dump.age` file cannot be passed directly to `pg_restore`; it must first
   be decrypted with the protected age identity.
3. Run the provided isolated drill, which creates a labelled ephemeral
   PostgreSQL container and never targets the live database or a persistent
   volume:

   ```bash
   bash scripts/restore-db-drill.sh --apply --backup /path/to/backup.dump.age
   ```

4. Validate the drill output, schema/object inventory, compatible application
   health/readiness, authentication, and representative read flows in a
   non-public recovery environment.
5. Measure elapsed time, compare it with RTO, record gaps, and assign follow-up
   work.

## Retention and access review

The current `--prune-retention` implementation removes only matching encrypted
daily artifacts older than `APPLE333_BACKUP_RETENTION_DAYS`. It does **not**
create monthly or annual retention tiers. The initial 35-daily / 12-monthly /
12-annual policy is an owner-approved target that needs separate storage and
lifecycle automation before it can be claimed as implemented.

At least quarterly, confirm the actual retention behavior, secondary-destination
failure-domain evidence, encryption/key access, operator permissions, and
deletion lifecycle. Retention changes require data-owner approval and should be
reflected in `deploy/` per the maintenance rule.
