#!/usr/bin/env bash
# Explicit application-only rollback for a verified bare-metal PM2 snapshot.
# It never runs Prisma, changes database data, or force-moves a Git branch.

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=bin/bare-metal-lib.sh
source "$SCRIPT_DIR/bin/bare-metal-lib.sh"

apply=false
snapshot=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) apply=true ;;
    --backup)
      [[ -n "${2:-}" ]] || die '--backup requires a snapshot directory.'
      snapshot="$2"
      shift
      ;;
    --help)
      cat <<'EOF'
Usage: ./deploy/rollback.sh --apply [--backup /var/backups/apple333/<snapshot>]

Restores only a verified prior application build and exact Git commit. The
database is never rolled back or mutated. Without --backup, the newest
Apple333 snapshot is selected for review.
EOF
      exit 0
      ;;
    *) die "Unknown option: $1" ;;
  esac
  shift
done

require_linux
verify_project_root
validate_bare_metal_environment
require_command pm2
require_command curl
assert_no_docker_lane
ensure_clean_tracked_worktree

if [[ -z "$snapshot" ]]; then
  shopt -s nullglob
  snapshots=("$APPLE333_BACKUP_DIR"/*)
  shopt -u nullglob
  for ((index = ${#snapshots[@]} - 1; index >= 0; index -= 1)); do
    [[ -f "${snapshots[$index]}/release.env" ]] || continue
    snapshot="${snapshots[$index]}"
    break
  done
fi

[[ -n "$snapshot" ]] || die 'No Apple333 release snapshot was found. No changes were made.'
if [[ "$apply" != true ]]; then
  assert_safe_snapshot_path "$snapshot"
  log "Dry-run only. Verified rollback snapshot: $snapshot"
  log 'Add --apply only after confirming this is the intended application build. The database will not be changed.'
  exit 0
fi

restore_application_snapshot "$snapshot"
