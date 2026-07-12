#!/usr/bin/env bash
# Stops a verified Apple333 deployment. Data is retained unless separately purged.

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

apply=false
purge_data=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) apply=true ;;
    --purge-owned-data) purge_data=true ;;
    --help)
      cat <<'EOF'
Usage: bash deploy/bin/uninstall.sh --apply [--purge-owned-data]

Default behavior removes only verified Apple333 containers/network and keeps
database/Redis volumes, state, backups, source checkout, and .env.production.
--purge-owned-data additionally creates a backup and then requires a typed
confirmation before removing only the labelled Apple333 data volumes.
EOF
      exit 0
      ;;
    *) die "Unknown uninstall option: $1" ;;
  esac
  shift
done

if [[ "$apply" != true ]]; then
  log "Dry-run only. Add --apply after reviewing this report."
  exec "$SCRIPT_DIR/preflight.sh"
fi

load_environment
require_docker_runtime
"$SCRIPT_DIR/preflight.sh" --assert-owned
acquire_deploy_lock

postgres_volume="${COMPOSE_PROJECT_NAME}_postgres_data"
redis_volume="${COMPOSE_PROJECT_NAME}_redis_data"

if [[ "$purge_data" == true ]]; then
  log "Starting only managed PostgreSQL long enough to verify ownership and create a backup."
  compose up -d postgres
  wait_for_service_health postgres 40
  [[ "$(database_classification)" == "OWNED_CURRENT" ]] || die "Cannot purge because database ownership is not proven"
  backup_database
  confirm_typed "PURGE APPLE333 DATA ${POSTGRES_SCHEMA}@${POSTGRES_DB}" "This permanently removes only the labelled Apple333 PostgreSQL and Redis volumes after the backup above."
  set_database_marker_status uninstalling
fi

log "Stopping and removing verified Apple333 service containers. Persistent volumes are retained by default."
compose down

if [[ "$purge_data" == true ]]; then
  [[ "$(docker_resource_classification volume "$postgres_volume")" == "OWNED_CURRENT" ]] || die "PostgreSQL volume ownership changed; refusing purge"
  [[ "$(docker_resource_classification volume "$redis_volume")" == "OWNED_CURRENT" ]] || die "Redis volume ownership changed; refusing purge"
  docker volume rm "$postgres_volume" "$redis_volume"
  rm -f "$STATE_FILE"
  log "Removed only the explicitly confirmed Apple333 data volumes. Source, secrets, and backups were retained."
else
  log "Application services were removed; verified data volumes and ownership markers remain for safe recovery."
fi
