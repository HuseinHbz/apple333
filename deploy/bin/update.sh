#!/usr/bin/env bash
# Updates a verified Apple333 deployment. Migration intent must be explicit.

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

apply=false
migration_decision=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) apply=true ;;
    --apply-migrations)
      [[ -z "$migration_decision" ]] || die "Choose only one migration option"
      migration_decision="apply"
      ;;
    --skip-migrations)
      [[ -z "$migration_decision" ]] || die "Choose only one migration option"
      migration_decision="skip"
      ;;
    --help)
      cat <<'EOF'
Usage: bash deploy/bin/update.sh --apply --apply-migrations
       bash deploy/bin/update.sh --apply --skip-migrations

Every release must explicitly declare whether reviewed migrations are applied.
--apply-migrations creates a database backup first. --skip-migrations is only
for a reviewed release with no database change.
EOF
      exit 0
      ;;
    *) die "Unknown update option: $1" ;;
  esac
  shift
done

if [[ "$apply" != true ]]; then
  log "Dry-run only. Add --apply and one migration decision after reviewing this report."
  exec "$SCRIPT_DIR/preflight.sh"
fi
[[ -n "$migration_decision" ]] || die "Choose --apply-migrations or --skip-migrations explicitly"

load_environment
require_docker_runtime
"$SCRIPT_DIR/preflight.sh" --assert-owned
acquire_deploy_lock

if [[ "$migration_decision" == "apply" ]]; then
  require_migration_bundle
  require_phase_04_1_pim_baseline_approval
fi

log "Ensuring verified infrastructure is running before release checks."
compose up -d postgres redis minio
wait_for_service_health postgres 40
wait_for_service_health redis 40
wait_for_service_health minio 40
[[ "$(database_classification)" == "OWNED_CURRENT" ]] || die "Database marker no longer proves ownership of this deployment"

migration_started=false
on_error() {
  local exit_code="$?"
  if [[ "$migration_started" == true ]]; then
    set_database_marker_status failed >/dev/null 2>&1 || true
  fi
  warn "Update stopped. The previous application containers and database backup were preserved; no automatic rollback was attempted."
  exit "$exit_code"
}
trap on_error ERR

if [[ "$migration_decision" == "apply" ]]; then
  log "Building the exact app and migration images for this reviewed release."
  build_release_images
  backup_database
  set_database_marker_status installing
  migration_started=true
  log "Checking and applying reviewed Prisma migrations."
  run_prisma migrate status
  run_prisma migrate deploy
  set_database_marker_status active
else
  warn "Proceeding without migrations because --skip-migrations was explicitly selected."
fi

log "Starting the updated application."
if [[ "$migration_decision" == "apply" ]]; then
  compose up -d app nginx
else
  compose up -d --build app nginx
fi
wait_for_service_health app 45
wait_for_readiness
record_deployed_at

trap - ERR
log "Update completed. No automatic database rollback is ever performed."
