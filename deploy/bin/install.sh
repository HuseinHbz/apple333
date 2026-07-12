#!/usr/bin/env bash
# Creates a fresh, isolated Apple333 deployment only after ownership checks.

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

apply=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) apply=true ;;
    --help)
      cat <<'EOF'
Usage: bash deploy/bin/install.sh --apply

Without --apply, the script performs only the read-only preflight report.
Installation refuses foreign/ambiguous resources and refuses to initialize a
database without reviewed Prisma migrations.
EOF
      exit 0
      ;;
    *) die "Unknown install option: $1" ;;
  esac
  shift
done

if [[ "$apply" != true ]]; then
  log "Dry-run only. Add --apply after reviewing this report."
  exec "$SCRIPT_DIR/preflight.sh"
fi

load_environment
require_docker_runtime
"$SCRIPT_DIR/preflight.sh" --assert-installable
require_migration_bundle
acquire_deploy_lock
ensure_install_id

migration_started=false
on_error() {
  local exit_code="$?"
  if [[ "$migration_started" == true ]]; then
    set_database_marker_status failed >/dev/null 2>&1 || true
  fi
  warn "Installation stopped. Existing data and resources were preserved for investigation."
  exit "$exit_code"
}
trap on_error ERR

log "Starting only the managed PostgreSQL and Redis services."
compose up -d postgres redis
wait_for_service_health postgres 40
wait_for_service_health redis 40

log "Creating the Apple333 database ownership marker in installing state."
set_database_marker_status installing
migration_started=true

log "Applying reviewed Prisma migrations. prisma db push/reset/seed are never used here."
compose run --rm app pnpm prisma migrate deploy
set_database_marker_status active

write_state_marker
log "Building and starting the application and reverse proxy."
compose up -d --build app nginx
wait_for_service_health app 45
wait_for_readiness
record_deployed_at

trap - ERR
log "Installation completed. Inspect status with: bash deploy/bin/status.sh"
