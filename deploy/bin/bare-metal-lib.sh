#!/usr/bin/env bash
# Shared, non-Docker safety primitives for the Apple333 bare-metal PM2 lane.
# This file deliberately does not source .env.production: environment files
# are data, never shell programs.

set -Eeuo pipefail
IFS=$'\n\t'

readonly APPLE333_BARE_METAL_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly APPLE333_DEPLOY_DIR="$(cd "$APPLE333_BARE_METAL_LIB_DIR/.." && pwd -P)"
readonly APPLE333_REPO_ROOT="$(cd "$APPLE333_DEPLOY_DIR/.." && pwd -P)"
readonly APPLE333_PROJECT_ID="apple333-enterprise-platform"

APPLE333_PM2_ENV_FILE="${APPLE333_PM2_ENV_FILE:-$APPLE333_REPO_ROOT/.env.production}"
APPLE333_BACKUP_DIR="${APPLE333_PM2_BACKUP_DIR:-/var/backups/apple333}"
APPLE333_LOG_DIR="${APPLE333_PM2_LOG_DIR:-/var/log/apple333}"
APPLE333_HTTP_PORT="${PORT:-3000}"
APPLE333_DEPLOY_BRANCH="${APPLE333_DEPLOY_BRANCH:-}"
APPLE333_GIT_REMOTE="${APPLE333_GIT_REMOTE:-origin}"
APPLE333_RELEASE_SNAPSHOT=""
APPLE333_ENV_LOADED=false
declare -A APPLE333_ENV_VALUES=()

log() { printf '[apple333 pm2] %s\n' "$*"; }
warn() { printf '[apple333 pm2][warning] %s\n' "$*" >&2; }
die() { printf '[apple333 pm2][error] %s\n' "$*" >&2; exit 1; }

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command is unavailable: $1"
}

require_linux() {
  [[ "$(uname -s)" == 'Linux' ]] || die 'Bare-metal PM2 deployment is supported only on Linux servers.'
}

is_safe_absolute_directory() {
  local candidate="$1"
  [[ "$candidate" == /* && "$candidate" != '/' && "$candidate" != *$'\n'* ]]
}

environment_value() {
  local key="$1"
  local value="${APPLE333_ENV_VALUES[$key]:-}"
  [[ -n "$value" ]] || die "Required production environment variable is missing or empty: $key"
  printf '%s' "$value"
}

optional_environment_value() {
  local key="$1"
  printf '%s' "${APPLE333_ENV_VALUES[$key]:-}"
}

has_placeholder() {
  local value="${1,,}"
  [[ "$value" == *'replace_with'* || "$value" == *'change-me'* || "$value" == *'placeholder'* || "$value" == *'<'* || "$value" == *'your_'* ]]
}

load_bare_metal_environment() {
  [[ "$APPLE333_ENV_LOADED" == true ]] && return 0

  [[ -f "$APPLE333_PM2_ENV_FILE" ]] || die "Missing production config: $APPLE333_PM2_ENV_FILE. Copy .env.production.example first."
  [[ ! -L "$APPLE333_PM2_ENV_FILE" ]] || die 'Production environment file must not be a symlink.'
  require_command stat

  local mode
  mode="$(stat -c '%a' "$APPLE333_PM2_ENV_FILE")" || die 'Could not read production environment file permissions.'
  [[ "$mode" =~ ^[0-7]{3,4}$ ]] || die 'Could not interpret production environment file permissions.'
  if (( (8#$mode & 8#077) != 0 )); then
    die "Production environment file must not be readable by group or others (current mode: $mode)."
  fi

  local raw_line line key value
  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    line="${raw_line%$'\r'}"
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ ! "$line" =~ ^([A-Z][A-Z0-9_]*)=(.*)$ ]]; then
      die 'Production environment file contains an invalid entry. Only plain uppercase KEY=value lines are allowed.'
    fi

    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    if [[ ${#value} -ge 2 && ( "${value:0:1}" == '"' || "${value:0:1}" == "'" ) && "${value: -1}" == "${value:0:1}" ]]; then
      value="${value:1:${#value}-2}"
    fi
    APPLE333_ENV_VALUES["$key"]="$value"
  done < "$APPLE333_PM2_ENV_FILE"

  APPLE333_ENV_LOADED=true
}

validate_bare_metal_environment() {
  load_bare_metal_environment

  local node_env runtime_environment app_url auth_url nextauth_url database_url auth_secret nextauth_secret redis_url hostname
  node_env="$(environment_value NODE_ENV)"
  runtime_environment="$(environment_value APPLE333_RUNTIME_ENVIRONMENT)"
  app_url="$(environment_value APP_URL)"
  auth_url="$(environment_value AUTH_URL)"
  nextauth_url="$(environment_value NEXTAUTH_URL)"
  database_url="$(environment_value DATABASE_URL)"
  auth_secret="$(environment_value AUTH_SECRET)"
  nextauth_secret="$(environment_value NEXTAUTH_SECRET)"
  redis_url="$(environment_value REDIS_URL)"
  hostname="$(optional_environment_value HOSTNAME)"

  [[ "$node_env" == 'production' ]] || die 'NODE_ENV must be production for a production PM2 deployment.'
  [[ "$runtime_environment" == 'production' ]] || die 'APPLE333_RUNTIME_ENVIRONMENT must be production for this deployment lane.'
  [[ "$app_url" =~ ^https://[^[:space:]]+$ ]] || die 'APP_URL must be an HTTPS URL in production.'
  [[ "$auth_url" =~ ^https://[^[:space:]]+$ ]] || die 'AUTH_URL must be an HTTPS URL in production.'
  [[ "$nextauth_url" =~ ^https://[^[:space:]]+$ ]] || die 'NEXTAUTH_URL must be an HTTPS URL in production.'
  [[ "$database_url" =~ ^postgres(ql)?://[^[:space:]]+$ ]] || die 'DATABASE_URL must be a PostgreSQL connection URL.'
  [[ "$redis_url" =~ ^rediss?://[^[:space:]]+$ ]] || die 'REDIS_URL must be a Redis connection URL.'
  [[ ${#auth_secret} -ge 32 ]] || die 'AUTH_SECRET must be at least 32 characters.'
  [[ ${#nextauth_secret} -ge 32 ]] || die 'NEXTAUTH_SECRET must be at least 32 characters.'

  local protected_value
  for protected_value in "$app_url" "$auth_url" "$nextauth_url" "$database_url" "$auth_secret" "$nextauth_secret" "$redis_url"; do
    has_placeholder "$protected_value" && die 'Production environment contains an unresolved placeholder.'
  done

  APPLE333_HTTP_PORT="$(optional_environment_value PORT)"
  APPLE333_HTTP_PORT="${APPLE333_HTTP_PORT:-3000}"
  [[ "$APPLE333_HTTP_PORT" =~ ^[0-9]+$ && "$APPLE333_HTTP_PORT" == '3000' ]] || die 'PORT must be 3000 because the reviewed nginx upstream is 127.0.0.1:3000.'
  [[ -z "$hostname" || "$hostname" == '127.0.0.1' ]] || die 'HOSTNAME must be 127.0.0.1 (or unset) for loopback-only PM2 binding.'

  APPLE333_DEPLOY_BRANCH="$(environment_value APPLE333_DEPLOY_BRANCH)"
  APPLE333_GIT_REMOTE="$(optional_environment_value APPLE333_GIT_REMOTE)"
  APPLE333_GIT_REMOTE="${APPLE333_GIT_REMOTE:-origin}"
  [[ "$APPLE333_DEPLOY_BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]] || die 'APPLE333_DEPLOY_BRANCH contains unsupported characters.'
  [[ "$APPLE333_GIT_REMOTE" =~ ^[A-Za-z0-9._-]+$ ]] || die 'APPLE333_GIT_REMOTE contains unsupported characters.'

  APPLE333_BACKUP_DIR="$(optional_environment_value APPLE333_PM2_BACKUP_DIR)"
  APPLE333_BACKUP_DIR="${APPLE333_BACKUP_DIR:-/var/backups/apple333}"
  APPLE333_LOG_DIR="$(optional_environment_value APPLE333_PM2_LOG_DIR)"
  APPLE333_LOG_DIR="${APPLE333_LOG_DIR:-/var/log/apple333}"
  is_safe_absolute_directory "$APPLE333_BACKUP_DIR" || die 'APPLE333_PM2_BACKUP_DIR must be a non-root absolute directory.'
  is_safe_absolute_directory "$APPLE333_LOG_DIR" || die 'APPLE333_PM2_LOG_DIR must be a non-root absolute directory.'

  local configured_pm2_home
  configured_pm2_home="$(optional_environment_value APPLE333_PM2_HOME)"
  if [[ -n "$configured_pm2_home" ]]; then
    is_safe_absolute_directory "$configured_pm2_home" || die 'APPLE333_PM2_HOME must be a non-root absolute directory when configured.'
    export PM2_HOME="$configured_pm2_home"
  fi

  export APPLE333_APP_ROOT="$APPLE333_REPO_ROOT"
  export APPLE333_PM2_ENV_FILE
}

verify_project_root() {
  require_command git
  [[ -f "$APPLE333_REPO_ROOT/package.json" ]] || die "package.json is missing from $APPLE333_REPO_ROOT"
  git -C "$APPLE333_REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die 'Deployment root is not a Git worktree.'
}

verify_node_and_pnpm() {
  require_command node
  require_command pnpm

  local node_version major minor expected_pnpm actual_pnpm
  node_version="$(node -p 'process.versions.node')"
  IFS='.' read -r major minor _ <<< "$node_version"
  [[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ ]] || die 'Could not determine Node.js version.'
  if (( 10#$major < 20 || (10#$major == 20 && 10#$minor < 18) )); then
    die "Node.js $node_version is unsupported. Apple333 requires Node.js >=20.18.0."
  fi

  expected_pnpm="$(node -p "require('$APPLE333_REPO_ROOT/package.json').packageManager")"
  [[ "$expected_pnpm" == pnpm@* ]] || die 'package.json must declare pnpm as the package manager.'
  actual_pnpm="$(pnpm --version)"
  [[ "$actual_pnpm" == "${expected_pnpm#pnpm@}" ]] || die "pnpm $actual_pnpm does not match packageManager $expected_pnpm."
}

check_capacity() {
  require_command df
  require_command free

  local available_kib available_memory_mb
  available_kib="$(df -Pk "$APPLE333_REPO_ROOT" | awk 'NR == 2 { print $4 }')"
  [[ "$available_kib" =~ ^[0-9]+$ ]] || die 'Could not determine available disk space.'
  (( available_kib >= 1048576 )) || die 'At least 1 GiB of free disk space is required for a safe staged build.'

  available_memory_mb="$(free -m | awk '/^Mem:/ { print $7 }')"
  [[ "$available_memory_mb" =~ ^[0-9]+$ ]] || die 'Could not determine available memory.'
  (( available_memory_mb >= 512 )) || die 'At least 512 MiB of available memory is required for a production build.'
}

assert_no_docker_lane() {
  command -v docker >/dev/null 2>&1 || return 0
  docker info >/dev/null 2>&1 || return 0

  local container_ids
  container_ids="$(docker ps -q --filter 'label=com.docker.compose.project=apple333-production' 2>/dev/null || true)"
  [[ -z "$container_ids" ]] || die 'A managed Apple333 Docker Compose deployment is running. Do not run PM2 and Docker on the same host/port.'
}

report_port_state() {
  command -v ss >/dev/null 2>&1 || { warn 'ss is unavailable; port ownership could not be reported.'; return 0; }

  if ss -ltnH "sport = :$APPLE333_HTTP_PORT" 2>/dev/null | grep -q .; then
    log "Port $APPLE333_HTTP_PORT is already listening; it must belong to the existing Apple333 PM2 process before reload."
  else
    log "Port $APPLE333_HTTP_PORT is available for the Apple333 PM2 process."
  fi
}

verify_nginx_configuration() {
  require_command nginx
  nginx -t >/dev/null 2>&1 || die 'nginx configuration test failed. Fix the host-owned nginx configuration before deployment.'
}

report_pm2_boot_persistence() {
  command -v systemctl >/dev/null 2>&1 || { warn 'systemctl is unavailable; verify PM2 boot persistence manually.'; return 0; }
  local service="pm2-$(id -un).service"
  if ! systemctl is-enabled "$service" >/dev/null 2>&1; then
    warn "PM2 boot persistence is not enabled for $service. Run 'pm2 startup systemd -u $(id -un) --hp $HOME' once, then run 'pm2 save'."
  fi
}

run_environment_preflight() {
  require_linux
  verify_project_root
  validate_bare_metal_environment
  verify_node_and_pnpm
  require_command pm2
  require_command curl
  check_capacity
  assert_no_docker_lane
  report_port_state
  verify_nginx_configuration
  report_pm2_boot_persistence
  log 'Environment, operating-system, runtime, capacity, proxy, and PM2 checks passed.'
}

ensure_clean_tracked_worktree() {
  git -C "$APPLE333_REPO_ROOT" diff --quiet || die 'Tracked working-tree changes exist. Resolve or commit them before a deployment; nothing was overwritten.'
  git -C "$APPLE333_REPO_ROOT" diff --cached --quiet || die 'Staged changes exist. Resolve or commit them before a deployment; nothing was overwritten.'
}

current_commit() {
  git -C "$APPLE333_REPO_ROOT" rev-parse HEAD
}

current_branch() {
  git -C "$APPLE333_REPO_ROOT" symbolic-ref --quiet --short HEAD 2>/dev/null || true
}

prepare_runtime_directories() {
  umask 077
  mkdir -p "$APPLE333_BACKUP_DIR" "$APPLE333_LOG_DIR"
  chmod 700 "$APPLE333_BACKUP_DIR" || warn "Could not restrict backup directory permissions: $APPLE333_BACKUP_DIR"
  chmod 750 "$APPLE333_LOG_DIR" || warn "Could not restrict log directory permissions: $APPLE333_LOG_DIR"
}

create_release_snapshot() {
  prepare_runtime_directories

  local timestamp previous_commit previous_branch environment_keys file_mode
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  previous_commit="$(current_commit)"
  previous_branch="$(current_branch)"
  APPLE333_RELEASE_SNAPSHOT="$APPLE333_BACKUP_DIR/${timestamp}-${previous_commit:0:12}"
  [[ ! -e "$APPLE333_RELEASE_SNAPSHOT" ]] || die "Backup snapshot path already exists: $APPLE333_RELEASE_SNAPSHOT"
  mkdir -p "$APPLE333_RELEASE_SNAPSHOT"
  chmod 700 "$APPLE333_RELEASE_SNAPSHOT" || true

  file_mode="$(stat -c '%a' "$APPLE333_PM2_ENV_FILE")"
  environment_keys="$(printf '%s\n' "${!APPLE333_ENV_VALUES[@]}" | sort | paste -sd, -)"
  cat > "$APPLE333_RELEASE_SNAPSHOT/release.env" <<EOF
PROJECT_ID=$APPLE333_PROJECT_ID
PREVIOUS_COMMIT=$previous_commit
PREVIOUS_BRANCH=$previous_branch
CREATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
ENVIRONMENT_FILE=$APPLE333_PM2_ENV_FILE
ENVIRONMENT_MODE=$file_mode
BUILD_STATE=$( [[ -d "$APPLE333_REPO_ROOT/.next" ]] && printf present || printf absent )
EOF
  printf 'Environment keys only (no values): %s\n' "$environment_keys" > "$APPLE333_RELEASE_SNAPSHOT/environment-metadata.txt"
  git -C "$APPLE333_REPO_ROOT" status --short --branch > "$APPLE333_RELEASE_SNAPSHOT/git-status.before.txt"
  pm2 status > "$APPLE333_RELEASE_SNAPSHOT/pm2-status.before.txt" 2>&1 || printf 'PM2 status unavailable before deployment.\n' > "$APPLE333_RELEASE_SNAPSHOT/pm2-status.before.txt"
  cp -p "$APPLE333_REPO_ROOT/ecosystem.config.js" "$APPLE333_RELEASE_SNAPSHOT/ecosystem.config.js"
  log "Created non-secret release snapshot: $APPLE333_RELEASE_SNAPSHOT"
}

update_checkout_to_configured_branch() {
  local remote="$APPLE333_GIT_REMOTE" branch="$APPLE333_DEPLOY_BRANCH"
  log "Fetching reviewed branch $remote/$branch."
  git -C "$APPLE333_REPO_ROOT" fetch --prune "$remote" "$branch"
  git -C "$APPLE333_REPO_ROOT" show-ref --verify --quiet "refs/remotes/$remote/$branch" || die "Configured remote branch was not found: $remote/$branch"

  if git -C "$APPLE333_REPO_ROOT" show-ref --verify --quiet "refs/heads/$branch"; then
    git -C "$APPLE333_REPO_ROOT" checkout "$branch"
  else
    git -C "$APPLE333_REPO_ROOT" checkout --track -b "$branch" "$remote/$branch"
  fi
  git -C "$APPLE333_REPO_ROOT" merge --ff-only "$remote/$branch"
}

install_dependencies_and_verify_database() {
  local database_url
  database_url="$(environment_value DATABASE_URL)"
  (
    cd "$APPLE333_REPO_ROOT"
    pnpm install --frozen-lockfile
    DATABASE_URL="$database_url" pnpm prisma:validate
    DATABASE_URL="$database_url" pnpm exec prisma generate
    DATABASE_URL="$database_url" pnpm exec node scripts/verify-production-database.mjs
  )
}

build_and_activate_standalone_release() {
  [[ -n "$APPLE333_RELEASE_SNAPSHOT" && -d "$APPLE333_RELEASE_SNAPSHOT" ]] || die 'A release snapshot must exist before building.'

  local timestamp staged_dist staged_path active_build
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  staged_dist=".next.stage-$timestamp"
  staged_path="$APPLE333_REPO_ROOT/$staged_dist"
  active_build="$APPLE333_REPO_ROOT/.next"
  [[ ! -e "$staged_path" ]] || die "Refusing to reuse an existing staged build directory: $staged_path"

  log 'Building a standalone release in an isolated staging directory.'
  (
    cd "$APPLE333_REPO_ROOT"
    NODE_ENV=production APPLE333_NEXT_DIST_DIR="$staged_dist" pnpm build
  )

  [[ -f "$staged_path/standalone/server.js" ]] || die 'Standalone build verification failed: server.js is missing.'
  [[ -d "$staged_path/static" ]] || die 'Standalone build verification failed: static assets are missing.'
  mkdir -p "$staged_path/standalone/.next"
  cp -a "$staged_path/static" "$staged_path/standalone/.next/static"
  if [[ -d "$APPLE333_REPO_ROOT/public" ]]; then
    cp -a "$APPLE333_REPO_ROOT/public" "$staged_path/standalone/public"
  fi

  if [[ -d "$active_build" ]]; then
    [[ ! -e "$APPLE333_RELEASE_SNAPSHOT/.next" ]] || die 'Release snapshot already contains a build; refusing to overwrite it.'
    mv "$active_build" "$APPLE333_RELEASE_SNAPSHOT/.next"
  fi
  mv "$staged_path" "$active_build"
  printf 'ACTIVATED_BUILD=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$APPLE333_RELEASE_SNAPSHOT/release.env"
  log 'Standalone build verified and activated.'
}

start_or_reload_pm2() {
  local ecosystem_file="$APPLE333_REPO_ROOT/ecosystem.config.js"
  [[ -f "$ecosystem_file" ]] || die 'Canonical PM2 ecosystem configuration is missing.'
  [[ -f "$APPLE333_REPO_ROOT/.next/standalone/server.js" ]] || die 'Standalone server artifact is missing; refusing to start PM2.'

  if pm2 describe apple333 >/dev/null 2>&1; then
    pm2 startOrReload "$ecosystem_file" --only apple333 --env production --update-env
  else
    pm2 start "$ecosystem_file" --only apple333 --env production --update-env
  fi
  pm2 save
}

verify_runtime_health() {
  local attempts="${1:-30}" attempt health_body ready_body health_url ready_url
  health_url="http://127.0.0.1:$APPLE333_HTTP_PORT/api/health"
  ready_url="http://127.0.0.1:$APPLE333_HTTP_PORT/api/ready"

  pm2 describe apple333 >/dev/null 2>&1 || die 'PM2 does not report an apple333 process after start/reload.'
  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    health_body="$(curl --silent --show-error --connect-timeout 2 --max-time 5 "$health_url" 2>/dev/null || true)"
    ready_body="$(curl --silent --show-error --connect-timeout 2 --max-time 5 "$ready_url" 2>/dev/null || true)"
    if [[ "$health_body" =~ \"status\":\"ok\" && "$health_body" =~ \"database\":\"connected\" && "$ready_body" =~ \"ready\":true ]]; then
      log 'Loopback health, readiness, and database checks passed.'
      return 0
    fi
    sleep 2
  done

  die 'Loopback health/readiness check failed. Inspect PM2 logs and protected environment; no secrets were printed.'
}

snapshot_value() {
  local snapshot="$1" key="$2"
  sed -n "s/^$key=//p" "$snapshot/release.env" | head -n 1
}

assert_safe_snapshot_path() {
  local snapshot="$1" backup_root resolved_snapshot resolved_root
  require_command realpath
  backup_root="$(realpath -e "$APPLE333_BACKUP_DIR")"
  resolved_snapshot="$(realpath -e "$snapshot")" || die 'Requested rollback snapshot does not exist.'
  resolved_root="$backup_root"
  [[ "$resolved_snapshot" == "$resolved_root"/* ]] || die 'Rollback snapshot must be inside the configured Apple333 backup directory.'
  [[ -f "$resolved_snapshot/release.env" ]] || die 'Rollback snapshot lacks release metadata.'
}

restore_application_snapshot() {
  local snapshot="$1" previous_commit snapshot_config active_build failed_build
  assert_safe_snapshot_path "$snapshot"
  previous_commit="$(snapshot_value "$snapshot" PREVIOUS_COMMIT)"
  [[ "$previous_commit" =~ ^[0-9a-f]{40}$ ]] || die 'Rollback snapshot has an invalid previous commit.'
  git -C "$APPLE333_REPO_ROOT" cat-file -e "$previous_commit^{commit}" || die 'Previous commit from rollback snapshot is no longer available locally.'
  snapshot_config="$snapshot/ecosystem.config.js"
  [[ -f "$snapshot_config" ]] || die 'Rollback snapshot lacks the canonical PM2 configuration.'

  # The caller checked the worktree before any deployment mutation. A detached
  # checkout restores an exact known commit without force-moving a branch.
  git -C "$APPLE333_REPO_ROOT" checkout --detach "$previous_commit"

  active_build="$APPLE333_REPO_ROOT/.next"
  if [[ -d "$snapshot/.next" ]]; then
    if [[ -d "$active_build" ]]; then
      failed_build="$snapshot/failed-build-$(date -u +%Y%m%dT%H%M%SZ)"
      mv "$active_build" "$failed_build"
    fi
    mv "$snapshot/.next" "$active_build"
  else
    warn 'Rollback snapshot has no prior build. PM2 will not be reloaded automatically.'
    return 0
  fi

  APPLE333_APP_ROOT="$APPLE333_REPO_ROOT" APPLE333_PM2_ENV_FILE="$APPLE333_PM2_ENV_FILE" \
    pm2 startOrReload "$snapshot_config" --only apple333 --env production --update-env
  pm2 save
  verify_runtime_health 15
  log "Application rollback completed to commit $previous_commit. Database was not changed."
}
