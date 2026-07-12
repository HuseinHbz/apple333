#!/usr/bin/env bash
# Read-only deployment inspection. It never creates, changes, or removes data.

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

assertion="report"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --assert-installable) assertion="installable" ;;
    --assert-owned) assertion="owned" ;;
    --help)
      cat <<'EOF'
Usage: bash deploy/bin/preflight.sh [--assert-installable|--assert-owned]

Default mode is read-only and reports ownership evidence. Assertion modes exit
non-zero when it is unsafe to install/update/uninstall.
EOF
      exit 0
      ;;
    *) die "Unknown preflight option: $1" ;;
  esac
  shift
done

load_environment
require_docker_runtime
compose config --quiet || die "Deployment compose configuration is invalid"

state_status="$(state_classification)"
postgres_volume="${COMPOSE_PROJECT_NAME}_postgres_data"
redis_volume="${COMPOSE_PROJECT_NAME}_redis_data"
private_network="${COMPOSE_PROJECT_NAME}_private"
postgres_volume_status="$(docker_resource_classification volume "$postgres_volume")"
redis_volume_status="$(docker_resource_classification volume "$redis_volume")"
network_status="$(docker_resource_classification network "$private_network")"

container_ids="$(docker ps -aq --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME")"
if [[ -z "$container_ids" ]]; then
  container_status="ABSENT"
else
  container_status="PRESENT"
fi

if [[ "$postgres_volume_status" == "ABSENT" && -z "$(postgres_container_id)" ]]; then
  database_status="NOT_CREATED"
else
  database_status="$(database_classification)"
fi

port_status="AVAILABLE"
if command -v ss >/dev/null 2>&1 && ss -ltnH "sport = :$APPLE333_HTTP_PORT" 2>/dev/null | grep -q .; then
  port_status="OCCUPIED"
fi

printf '\nApple333 deployment preflight (read-only)\n'
printf '  install root: %s\n' "$REPO_ROOT"
printf '  environment: %s\n' "$APPLE333_ENVIRONMENT"
printf '  compose project: %s\n' "$COMPOSE_PROJECT_NAME"
printf '  state marker: %s\n' "$state_status"
printf '  postgres volume (%s): %s\n' "$postgres_volume" "$postgres_volume_status"
printf '  redis volume (%s): %s\n' "$redis_volume" "$redis_volume_status"
printf '  private network (%s): %s\n' "$private_network" "$network_status"
printf '  project containers: %s\n' "$container_status"
printf '  database/schema evidence: %s\n' "$database_status"
printf '  HTTP bind %s:%s: %s\n' "$APPLE333_HTTP_BIND" "$APPLE333_HTTP_PORT" "$port_status"

unsafe=false
for status in "$state_status" "$postgres_volume_status" "$redis_volume_status" "$network_status" "$database_status"; do
  case "$status" in
    FOREIGN|OWNED_OTHER_APPLE333) unsafe=true ;;
  esac
done
[[ "$port_status" == "OCCUPIED" ]] && unsafe=true

if [[ "$unsafe" == true ]]; then
  warn "A foreign, ambiguous, or occupied resource was detected. Nothing was changed."
  if [[ -t 0 ]]; then
    read -r -p "Show the safe removal policy for the exact conflicting resource? [y/N] " answer
    if [[ "${answer,,}" == "y" || "${answer,,}" == "yes" ]]; then
      cat <<'EOF'
No resource is deleted automatically. Back up the exact resource first, then
use deploy/bin/purge-unrelated.sh only for a named Docker volume/network after
its typed confirmation. External/shared databases are never dropped by these
scripts; choose a new dedicated database/schema or handle them under a separate
approved database change procedure.
EOF
    fi
  fi
fi

case "$assertion" in
  report)
    exit 0
    ;;
  installable)
    [[ "$state_status" == "ABSENT" ]] || die "An Apple333 state marker already exists; use update.sh or investigate recovery instead of install.sh"
    [[ "$postgres_volume_status" == "ABSENT" && "$redis_volume_status" == "ABSENT" && "$network_status" == "ABSENT" ]] || die "Existing Docker resources are not a fresh verified Apple333 installation"
    [[ "$database_status" == "NOT_CREATED" || "$database_status" == "EMPTY" ]] || die "Target database/schema is not proven empty and dedicated to this installation"
    [[ "$port_status" == "AVAILABLE" ]] || die "Configured HTTP port is occupied; choose a free port or reconfigure the reverse proxy"
    ;;
  owned)
    [[ "$state_status" == "OWNED_CURRENT" ]] || die "Deployment state is not owned by this Apple333 checkout/environment"
    for status in "$postgres_volume_status" "$redis_volume_status" "$network_status"; do
      [[ "$status" == "OWNED_CURRENT" || "$status" == "ABSENT" ]] || die "Docker resource ownership is not verified: $status"
    done
    case "$database_status" in
      OWNED_CURRENT|UNREACHABLE) ;;
      *) die "Database/schema ownership is not verified: $database_status" ;;
    esac
    ;;
esac
