#!/usr/bin/env bash
# Loopback-only post-deployment health check. /api/health includes dependency
# status; /api/ready remains the strict deployment readiness endpoint.

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=bin/bare-metal-lib.sh
source "$SCRIPT_DIR/bin/bare-metal-lib.sh"

attempts=30
if [[ "${1:-}" == '--attempts' ]]; then
  [[ "${2:-}" =~ ^[1-9][0-9]*$ ]] || die 'Health-check attempts must be a positive integer.'
  attempts="$2"
  shift 2
elif [[ "${1:-}" == '--help' ]]; then
  cat <<'EOF'
Usage: ./deploy/health-check.sh [--attempts NUMBER]

Checks only 127.0.0.1:3000. It requires PM2, application health, readiness,
and a connected database; it does not expose secrets or touch the database.
EOF
  exit 0
fi
[[ $# -eq 0 ]] || die "Unknown option: $1"

require_linux
verify_project_root
validate_bare_metal_environment
require_command pm2
require_command curl
verify_runtime_health "$attempts"
