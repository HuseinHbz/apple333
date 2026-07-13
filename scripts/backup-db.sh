#!/usr/bin/env bash
# Creates an encrypted, ownership-verified PostgreSQL backup for Apple333.

set -Eeuo pipefail
IFS=$'\n\t'

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
# shellcheck source=../deploy/bin/lib.sh
source "$REPO_ROOT/deploy/bin/lib.sh"

apply=false
prune_retention=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) apply=true ;;
    --prune-retention) prune_retention=true ;;
    --help)
      cat <<'EOF'
Usage: bash scripts/backup-db.sh --apply [--prune-retention]

Creates an encrypted custom-format PostgreSQL backup only after proving the
current deployment and database ownership. The script requires an age recipient
and a separate off-host backup directory in the protected deployment env file.
Retention pruning is opt-in and affects only verified Apple333 .dump.age files.
EOF
      exit 0
      ;;
    *) die "Unknown backup option: $1" ;;
  esac
  shift
done

if [[ "$apply" != true ]]; then
  log "Dry-run only. Add --apply after reviewing the read-only preflight report."
  exec "$REPO_ROOT/deploy/bin/preflight.sh" --assert-owned
fi

load_environment
require_docker_runtime
"$REPO_ROOT/deploy/bin/preflight.sh" --assert-owned
acquire_deploy_lock

: "${APPLE333_BACKUP_OFFSITE_DIR:?APPLE333_BACKUP_OFFSITE_DIR is required for off-host backup replication}"
: "${APPLE333_BACKUP_RETENTION_DAYS:?APPLE333_BACKUP_RETENTION_DAYS is required}"
[[ "$APPLE333_BACKUP_OFFSITE_DIR" == /* && "$APPLE333_BACKUP_OFFSITE_DIR" != "/" ]] || die "APPLE333_BACKUP_OFFSITE_DIR must be a non-root absolute path"
[[ ! -L "$APPLE333_BACKUP_OFFSITE_DIR" ]] || die "APPLE333_BACKUP_OFFSITE_DIR must not be a symlink"
[[ "$APPLE333_BACKUP_RETENTION_DAYS" =~ ^[1-9][0-9]{0,3}$ ]] || die "APPLE333_BACKUP_RETENTION_DAYS must be a positive whole number"
mkdir -p "$APPLE333_BACKUP_OFFSITE_DIR"
chmod 700 "$APPLE333_BACKUP_OFFSITE_DIR" || warn "Could not restrict off-host backup directory permissions"
[[ "$(canonical_path "$APPLE333_BACKUP_OFFSITE_DIR")" != "$(canonical_path "$APPLE333_BACKUP_DIR")" ]] || die "APPLE333_BACKUP_OFFSITE_DIR must be a separate location from APPLE333_BACKUP_DIR"

backup_database
install -m 600 "$BACKUP_DATABASE_OUTPUT" "$APPLE333_BACKUP_OFFSITE_DIR/$(basename "$BACKUP_DATABASE_OUTPUT")"
install -m 600 "$BACKUP_DATABASE_CHECKSUM" "$APPLE333_BACKUP_OFFSITE_DIR/$(basename "$BACKUP_DATABASE_CHECKSUM")"

local_checksum="$(sha256sum "$BACKUP_DATABASE_OUTPUT" | awk '{print $1}')"
offsite_checksum="$(sha256sum "$APPLE333_BACKUP_OFFSITE_DIR/$(basename "$BACKUP_DATABASE_OUTPUT")" | awk '{print $1}')"
[[ "$local_checksum" == "$offsite_checksum" ]] || die "Off-host backup checksum mismatch; retention was not changed"

if [[ "$prune_retention" == true ]]; then
  prefix="${APPLE333_ENVIRONMENT}-${POSTGRES_DB}-${APPLE333_INSTALL_ID}-"
  while IFS= read -r stale; do
    [[ -n "$stale" ]] || continue
    rm -f -- "$stale" "${stale}.sha256"
  done < <(find "$APPLE333_BACKUP_DIR" -maxdepth 1 -type f -name "${prefix}*.dump.age" -mtime "+$APPLE333_BACKUP_RETENTION_DAYS" -print)
  while IFS= read -r stale; do
    [[ -n "$stale" ]] || continue
    rm -f -- "$stale" "${stale}.sha256"
  done < <(find "$APPLE333_BACKUP_OFFSITE_DIR" -maxdepth 1 -type f -name "${prefix}*.dump.age" -mtime "+$APPLE333_BACKUP_RETENTION_DAYS" -print)
  log "Pruned only Apple333 encrypted backup artifacts older than $APPLE333_BACKUP_RETENTION_DAYS days."
fi

log "Encrypted backup and checksum were replicated to the configured off-host directory."
