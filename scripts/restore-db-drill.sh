#!/usr/bin/env bash
# Restores an encrypted backup into an ephemeral, isolated PostgreSQL container.
# It never points pg_restore at the live Apple333 database or a persistent volume.

set -Eeuo pipefail
IFS=$'\n\t'

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
# shellcheck source=../deploy/bin/lib.sh
source "$REPO_ROOT/deploy/bin/lib.sh"

apply=false
backup_file=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) apply=true ;;
    --backup)
      shift
      [[ $# -gt 0 ]] || die "--backup requires an encrypted .dump.age path"
      backup_file="$1"
      ;;
    --help)
      cat <<'EOF'
Usage: bash scripts/restore-db-drill.sh --apply --backup /path/to/file.dump.age

Creates a labelled, ephemeral PostgreSQL container, restores the selected
encrypted backup into it, runs non-destructive checks, then removes only that
container. It refuses live targets and requires an age identity file configured
in the protected deployment environment.
EOF
      exit 0
      ;;
    *) die "Unknown restore-drill option: $1" ;;
  esac
  shift
done

[[ "$apply" == true ]] || die "Restore drills require explicit --apply"
[[ -n "$backup_file" ]] || die "Provide a backup with --backup"

load_environment
require_docker_runtime
"$REPO_ROOT/deploy/bin/preflight.sh" --assert-owned
acquire_deploy_lock

: "${APPLE333_BACKUP_AGE_IDENTITY_FILE:?APPLE333_BACKUP_AGE_IDENTITY_FILE is required for a restore drill}"
: "${APPLE333_BACKUP_OFFSITE_DIR:?APPLE333_BACKUP_OFFSITE_DIR is required for a restore drill}"
require_command age
[[ "$backup_file" == *.dump.age && -f "$backup_file" ]] || die "Backup must be an existing encrypted .dump.age file"
[[ "$APPLE333_BACKUP_AGE_IDENTITY_FILE" == /* && -f "$APPLE333_BACKUP_AGE_IDENTITY_FILE" ]] || die "APPLE333_BACKUP_AGE_IDENTITY_FILE must be an existing absolute path"
[[ ! -L "$APPLE333_BACKUP_AGE_IDENTITY_FILE" ]] || die "APPLE333_BACKUP_AGE_IDENTITY_FILE must not be a symlink"

backup_file="$(canonical_path "$backup_file")"
backup_directory="$(canonical_path "$(dirname "$backup_file")")"
local_backup_directory="$(canonical_path "$APPLE333_BACKUP_DIR")"
offsite_backup_directory="$(canonical_path "$APPLE333_BACKUP_OFFSITE_DIR")"
[[ "$backup_directory" == "$local_backup_directory" || "$backup_directory" == "$offsite_backup_directory" ]] || die "Restore drill backup must be in the configured local or secondary backup directory"
backup_name="$(basename "$backup_file")"
[[ "$backup_name" == "${APPLE333_ENVIRONMENT}-${POSTGRES_DB}-${APPLE333_INSTALL_ID}-"*.dump.age ]] || die "Backup filename does not match the current Apple333 deployment identity"

checksum_file="${backup_file}.sha256"
[[ -f "$checksum_file" ]] || die "A matching checksum file is required: $checksum_file"
checksum_name="$(basename "$checksum_file")"
checksum_target="$(awk 'NR == 1 { print $2 }' "$checksum_file")"
checksum_lines="$(awk 'END { print NR }' "$checksum_file")"
[[ "$checksum_lines" == "1" && "$checksum_target" == "$backup_name" ]] || die "Checksum manifest must contain exactly the selected relative backup filename"
(cd "$backup_directory" && sha256sum --strict -c "$checksum_name") >/dev/null

require_command openssl
container="${COMPOSE_PROJECT_NAME}-restore-drill-$(openssl rand -hex 6)"
drill_password="$(openssl rand -hex 24)"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --rm --name "$container" \
  --label "com.apple333.project=$PROJECT_KEY" \
  --label "com.apple333.managed=true" \
  --label "com.apple333.install-id=$APPLE333_INSTALL_ID" \
  -e POSTGRES_DB=apple333_restore_drill \
  -e POSTGRES_USER=apple333_restore_drill \
  -e POSTGRES_PASSWORD="$drill_password" \
  postgres:16.6-alpine3.20 >/dev/null

for attempt in {1..30}; do
  if docker exec "$container" pg_isready -U apple333_restore_drill -d apple333_restore_drill >/dev/null 2>&1; then
    break
  fi
  [[ "$attempt" -lt 30 ]] || die "Ephemeral restore-drill PostgreSQL did not become ready"
  sleep 2
done

age -d -i "$APPLE333_BACKUP_AGE_IDENTITY_FILE" "$backup_file" \
  | docker exec -i -e "PGPASSWORD=$drill_password" "$container" pg_restore \
      --exit-on-error --no-owner --no-privileges -U apple333_restore_drill -d apple333_restore_drill

docker exec -e "PGPASSWORD=$drill_password" "$container" \
  psql -v ON_ERROR_STOP=1 -U apple333_restore_drill -d apple333_restore_drill -Atqc 'SELECT 1' >/dev/null

log "Restore drill completed in an ephemeral labelled container. No production database or persistent volume was changed."
