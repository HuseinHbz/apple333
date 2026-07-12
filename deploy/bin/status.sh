#!/usr/bin/env bash
# Read-only operational status report.

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

load_environment
require_docker_runtime
"$SCRIPT_DIR/preflight.sh"
printf '\nCompose services:\n'
compose ps || true
printf '\nReadiness endpoint:\n'
if command -v curl >/dev/null 2>&1; then
  curl --silent --show-error "http://127.0.0.1:$APPLE333_HTTP_PORT/api/ready" || true
  printf '\n'
else
  printf 'curl is not installed; readiness was not queried.\n'
fi
