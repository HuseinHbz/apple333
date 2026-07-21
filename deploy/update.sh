#!/usr/bin/env bash
# Safe code-only update for the bare-metal PM2 lane. The current Phase 04.1
# migration remains production-blocked; this script will never infer, reset,
# push, or automatically deploy a database schema.

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=bin/bare-metal-lib.sh
source "$SCRIPT_DIR/bin/bare-metal-lib.sh"

install_mode=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --install) install_mode=true ;;
    --skip-migrations)
      warn '--skip-migrations is implicit for this release; no production migration will run.'
      ;;
    --apply-migrations)
      die 'Phase 04.1 PIM migrations are production-blocked in this release. No command flag can authorize prisma migrate deploy.'
      ;;
    --help)
      cat <<'EOF'
Usage: ./deploy/update.sh
       ./deploy/install.sh

Performs a safe, code-only PM2 release: read-only preflight, non-secret
snapshot, fetch + fast-forward-only checkout of APPLE333_DEPLOY_BRANCH,
frozen dependency installation, Prisma client generation, read-only database
connectivity check, staged standalone build, PM2 production reload, and
loopback health/readiness verification. A failure after a build swap triggers
an application-only rollback. Database migrations are intentionally blocked
for the current Phase 04.1 release.
EOF
      exit 0
      ;;
    *) die "Unknown option: $1" ;;
  esac
  shift
done

rollback_in_progress=false
handle_failure() {
  local exit_code="$?"
  trap - ERR
  if [[ -n "$APPLE333_RELEASE_SNAPSHOT" && -d "$APPLE333_RELEASE_SNAPSHOT" && "$rollback_in_progress" == false ]]; then
    rollback_in_progress=true
    warn 'Deployment failed. Attempting application/build rollback only; the database will remain untouched.'
    if ! ( restore_application_snapshot "$APPLE333_RELEASE_SNAPSHOT" ); then
      warn "Automatic application rollback also failed. Preserve $APPLE333_RELEASE_SNAPSHOT and inspect PM2 logs."
    fi
  fi
  exit "$exit_code"
}

run_environment_preflight
ensure_clean_tracked_worktree

if [[ "$install_mode" == true ]] && pm2 describe apple333 >/dev/null 2>&1; then
  die 'An apple333 PM2 process already exists. Use ./deploy/update.sh instead of install.sh.'
fi

create_release_snapshot
trap handle_failure ERR

update_checkout_to_configured_branch
install_dependencies_and_verify_database
build_and_activate_standalone_release
start_or_reload_pm2
verify_runtime_health

trap - ERR
log 'Production code update completed. Prisma migrations and database rollback were not performed.'
