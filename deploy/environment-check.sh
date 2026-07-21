#!/usr/bin/env bash
# Read-only bare-metal PM2 readiness check. It intentionally does not connect
# to or mutate the database, Git worktree, PM2 process list, or nginx files.

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=bin/bare-metal-lib.sh
source "$SCRIPT_DIR/bin/bare-metal-lib.sh"

if [[ "${1:-}" == '--help' ]]; then
  cat <<'EOF'
Usage: ./deploy/environment-check.sh

Validates the Linux host, Node/pnpm/PM2 prerequisites, root .env.production
permissions and non-secret configuration shape, capacity, nginx syntax, port
state, and Docker/PM2 mutual exclusion. It makes no deployment changes.
EOF
  exit 0
fi

[[ $# -eq 0 ]] || die "Unknown option: $1"
run_environment_preflight
ensure_clean_tracked_worktree
log 'Tracked Git worktree is clean. Environment check completed without changes.'
