#!/usr/bin/env bash
# Deliberately narrow emergency cleanup for a named Docker resource only.
# It never drops an external/shared PostgreSQL database.

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

kind=""
name=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --volume)
      kind="volume"; name="${2:-}"; shift
      ;;
    --network)
      kind="network"; name="${2:-}"; shift
      ;;
    --help)
      cat <<'EOF'
Usage: bash deploy/bin/purge-unrelated.sh --volume NAME
       bash deploy/bin/purge-unrelated.sh --network NAME

Use only after taking a verified backup. This command is intentionally unable
to drop an external PostgreSQL database or execute broad Docker pruning.
EOF
      exit 0
      ;;
    *) die "Unknown purge option: $1" ;;
  esac
  shift
done

[[ "$kind" == "volume" || "$kind" == "network" ]] || die "Choose exactly one resource type"
[[ -n "$name" ]] || die "A resource name is required"
[[ "$name" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,127}$ ]] || die "Refusing unsafe resource name"

load_environment
require_docker_runtime
docker "$kind" inspect "$name" >/dev/null 2>&1 || die "Resource does not exist: $kind/$name"

warn "This is an unrelated or unverified Docker $kind. It will be permanently removed."
warn "The command never uses docker system prune and affects only: $kind/$name"
confirm_typed "PURGE UNRELATED $kind $name" "Confirm that you have an independent backup and want to delete this exact resource."
docker "$kind" rm "$name"
log "Removed only the explicitly confirmed resource: $kind/$name"
