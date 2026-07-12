#!/usr/bin/env bash
# Shared safety primitives for the Apple333 production deployment scripts.
# This file is sourced; callers must invoke load_environment before mutations.

set -Eeuo pipefail
IFS=$'\n\t'

readonly DEPLOY_BIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly DEPLOY_DIR="$(cd "$DEPLOY_BIN_DIR/.." && pwd -P)"
readonly REPO_ROOT="$(cd "$DEPLOY_DIR/.." && pwd -P)"
readonly ENV_FILE="${APPLE333_ENV_FILE:-$DEPLOY_DIR/.env.production}"
readonly COMPOSE_FILE="$DEPLOY_DIR/compose.production.yml"
readonly PROJECT_KEY="apple333-enterprise-platform"

log() { printf '[apple333 deploy] %s\n' "$*"; }
warn() { printf '[apple333 deploy][warning] %s\n' "$*" >&2; }
die() { printf '[apple333 deploy][error] %s\n' "$*" >&2; exit 1; }

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command is unavailable: $1"
}

canonical_path() {
  realpath -e "$1" 2>/dev/null || realpath -m "$1"
}

state_value() {
  local key="$1"
  [[ -f "$STATE_FILE" ]] || return 0
  sed -n "s/^${key}=//p" "$STATE_FILE" | tail -n 1
}

has_placeholder() {
  local value="${1,,}"
  [[ -z "$value" || "$value" == *"replace-with"* || "$value" == *"change-me"* || "$value" == *"example.com"* || "$value" == *"<"* ]]
}

load_environment() {
  [[ -f "$ENV_FILE" ]] || die "Missing production config: $ENV_FILE. Copy deploy/.env.production.example first."
  [[ -f "$COMPOSE_FILE" ]] || die "Missing deployment compose file: $COMPOSE_FILE"

  # The file is operator-controlled and must not be writable by untrusted users.
  local mode
  mode="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || true)"
  [[ -z "$mode" || "$mode" =~ ^[0-7]{3,4}$ ]] || die "Cannot determine permissions for $ENV_FILE"
  if [[ -n "$mode" && "${mode: -1}" != "0" ]]; then
    warn "$ENV_FILE is world-readable. Set chmod 600 before production deployment."
  fi

  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  : "${APPLE333_PROJECT_ID:?APPLE333_PROJECT_ID is required}"
  : "${APPLE333_ENVIRONMENT:?APPLE333_ENVIRONMENT is required}"
  : "${COMPOSE_PROJECT_NAME:?COMPOSE_PROJECT_NAME is required}"
  : "${APPLE333_INSTALL_ROOT:?APPLE333_INSTALL_ROOT is required}"
  : "${APPLE333_STATE_DIR:?APPLE333_STATE_DIR is required}"
  : "${APPLE333_BACKUP_DIR:?APPLE333_BACKUP_DIR is required}"
  : "${APPLE333_HTTP_BIND:?APPLE333_HTTP_BIND is required}"
  : "${APPLE333_HTTP_PORT:?APPLE333_HTTP_PORT is required}"
  : "${APP_URL:?APP_URL is required}"
  : "${AUTH_URL:?AUTH_URL is required}"
  : "${AUTH_SECRET:?AUTH_SECRET is required}"
  : "${DATABASE_URL:?DATABASE_URL is required}"
  : "${POSTGRES_DB:?POSTGRES_DB is required}"
  : "${POSTGRES_SCHEMA:?POSTGRES_SCHEMA is required}"
  : "${POSTGRES_USER:?POSTGRES_USER is required}"
  : "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

  [[ "$APPLE333_PROJECT_ID" == "$PROJECT_KEY" ]] || die "APPLE333_PROJECT_ID must be $PROJECT_KEY"
  [[ "$APPLE333_ENVIRONMENT" =~ ^[a-z][a-z0-9-]{1,31}$ ]] || die "APPLE333_ENVIRONMENT contains unsafe characters"
  [[ "$COMPOSE_PROJECT_NAME" =~ ^[a-z0-9][a-z0-9_-]{1,62}$ ]] || die "COMPOSE_PROJECT_NAME contains unsafe characters"
  [[ "$APPLE333_STATE_DIR" == /* && "$APPLE333_STATE_DIR" != "/" ]] || die "APPLE333_STATE_DIR must be a non-root absolute path"
  [[ "$APPLE333_BACKUP_DIR" == /* && "$APPLE333_BACKUP_DIR" != "/" ]] || die "APPLE333_BACKUP_DIR must be a non-root absolute path"
  [[ ! -L "$APPLE333_STATE_DIR" ]] || die "APPLE333_STATE_DIR must not be a symlink"
  [[ ! -L "$APPLE333_BACKUP_DIR" ]] || die "APPLE333_BACKUP_DIR must not be a symlink"
  [[ "$POSTGRES_DB" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || die "POSTGRES_DB contains unsafe characters"
  [[ "$POSTGRES_SCHEMA" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || die "POSTGRES_SCHEMA contains unsafe characters"
  [[ "$POSTGRES_SCHEMA" != "public" ]] || die "POSTGRES_SCHEMA must be dedicated to Apple333; public is not permitted"
  [[ "$APPLE333_HTTP_PORT" =~ ^[0-9]{2,5}$ ]] || die "APPLE333_HTTP_PORT must be numeric"
  [[ ${#AUTH_SECRET} -ge 32 ]] || die "AUTH_SECRET must be at least 32 characters"
  [[ "$AUTH_SECRET" =~ ^[A-Za-z0-9._~+/=-]+$ ]] || die "AUTH_SECRET must be shell-safe base64/hex; use openssl rand -hex 32"
  [[ "$POSTGRES_PASSWORD" =~ ^[A-Za-z0-9._~-]{20,}$ ]] || die "POSTGRES_PASSWORD must be a shell-safe value of at least 20 characters; use openssl rand -hex 32"
  has_placeholder "$AUTH_SECRET" && die "AUTH_SECRET still contains a placeholder"
  has_placeholder "$POSTGRES_PASSWORD" && die "POSTGRES_PASSWORD still contains a placeholder"
  has_placeholder "$APP_URL" && die "APP_URL still contains a placeholder"
  [[ "$APP_URL" =~ ^https:// ]] || die "APP_URL must use HTTPS in production"
  [[ "$AUTH_URL" == "$APP_URL" ]] || die "AUTH_URL must match APP_URL"
  [[ -z "${NEXTAUTH_URL:-}" || "$NEXTAUTH_URL" == "$APP_URL" ]] || die "NEXTAUTH_URL must match APP_URL when provided"
  [[ -z "${NEXTAUTH_SECRET:-}" || "$NEXTAUTH_SECRET" == "$AUTH_SECRET" ]] || die "NEXTAUTH_SECRET must match AUTH_SECRET when provided"
  [[ "$DATABASE_URL" == postgresql://* ]] || die "DATABASE_URL must use the PostgreSQL URL scheme"
  [[ "$DATABASE_URL" == *"@postgres:5432/${POSTGRES_DB}"* ]] || die "This managed deployment bundle only supports its labelled postgres service; do not point it at an external/shared database"
  [[ "$DATABASE_URL" == *"schema=$POSTGRES_SCHEMA"* ]] || die "DATABASE_URL must target schema=$POSTGRES_SCHEMA"
  [[ "$(canonical_path "$APPLE333_INSTALL_ROOT")" == "$REPO_ROOT" ]] || die "APPLE333_INSTALL_ROOT must resolve to this checkout: $REPO_ROOT"
  [[ "$REPO_ROOT" != "/" ]] || die "Refusing to operate from filesystem root"

  export STATE_FILE="$APPLE333_STATE_DIR/${APPLE333_ENVIRONMENT}.state"
}

ensure_install_id() {
  [[ -n "${APPLE333_INSTALL_ID:-}" ]] && return 0
  require_command openssl
  local install_id
  install_id="$(openssl rand -hex 16)"
  if grep -q '^APPLE333_INSTALL_ID=' "$ENV_FILE"; then
    sed -i "s/^APPLE333_INSTALL_ID=.*/APPLE333_INSTALL_ID=$install_id/" "$ENV_FILE"
  else
    printf '\nAPPLE333_INSTALL_ID=%s\n' "$install_id" >> "$ENV_FILE"
  fi
  chmod 600 "$ENV_FILE" || warn "Could not set restrictive permissions on $ENV_FILE"
  APPLE333_INSTALL_ID="$install_id"
  export APPLE333_INSTALL_ID
  log "Generated and recorded a new Apple333 install identifier."
}

compose() {
  docker compose --project-name "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

require_docker_runtime() {
  require_command docker
  docker info >/dev/null 2>&1 || die "Docker daemon is not reachable"
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required"
}

require_migration_bundle() {
  [[ -d "$REPO_ROOT/prisma/migrations" ]] || die "No reviewed Prisma migration bundle exists. Refusing to install or change the database; never use prisma db push as a substitute."
  find "$REPO_ROOT/prisma/migrations" -name migration.sql -type f -print -quit | grep -q . || die "No reviewed Prisma migration SQL exists. Refusing database initialization."
}

state_classification() {
  if [[ ! -f "$STATE_FILE" ]]; then
    printf 'ABSENT'
    return 0
  fi
  local state_project state_root state_compose state_environment
  state_project="$(state_value PROJECT_ID)"
  state_root="$(state_value INSTALL_ROOT)"
  state_compose="$(state_value COMPOSE_PROJECT_NAME)"
  state_environment="$(state_value ENVIRONMENT)"
  if [[ "$state_project" == "$PROJECT_KEY" && "$state_root" == "$REPO_ROOT" && "$state_compose" == "$COMPOSE_PROJECT_NAME" && "$state_environment" == "$APPLE333_ENVIRONMENT" ]]; then
    printf 'OWNED_CURRENT'
  elif [[ "$state_project" == "$PROJECT_KEY" ]]; then
    printf 'OWNED_OTHER_APPLE333'
  else
    printf 'FOREIGN'
  fi
}

docker_resource_classification() {
  local kind="$1" name="$2"
  if ! docker "$kind" inspect "$name" >/dev/null 2>&1; then
    printf 'ABSENT'
    return 0
  fi
  local project managed install_id
  project="$(docker "$kind" inspect -f '{{ index .Labels "com.apple333.project" }}' "$name" 2>/dev/null || true)"
  managed="$(docker "$kind" inspect -f '{{ index .Labels "com.apple333.managed" }}' "$name" 2>/dev/null || true)"
  install_id="$(docker "$kind" inspect -f '{{ index .Labels "com.apple333.install-id" }}' "$name" 2>/dev/null || true)"
  if [[ "$project" == "$PROJECT_KEY" && "$managed" == "true" && -n "$install_id" && "$install_id" == "${APPLE333_INSTALL_ID:-}" ]]; then
    printf 'OWNED_CURRENT'
  elif [[ "$project" == "$PROJECT_KEY" && "$managed" == "true" ]]; then
    printf 'OWNED_OTHER_APPLE333'
  else
    printf 'FOREIGN'
  fi
}

postgres_container_id() {
  docker ps -aq \
    --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" \
    --filter 'label=com.docker.compose.service=postgres' | head -n 1
}

postgres_query() {
  local container="$1" sql="$2"
  docker exec -e "PGPASSWORD=$POSTGRES_PASSWORD" "$container" \
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc "$sql"
}

database_classification() {
  local container
  container="$(postgres_container_id)"
  [[ -n "$container" ]] || { printf 'UNREACHABLE'; return 0; }
  local state
  state="$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || true)"
  [[ "$state" == "true" ]] || { printf 'UNREACHABLE'; return 0; }

  local schema_exists table_exists metadata table_count
  schema_exists="$(postgres_query "$container" "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = '$POSTGRES_SCHEMA')")" || { printf 'UNREACHABLE'; return 0; }
  [[ "$schema_exists" == "t" ]] || { printf 'EMPTY'; return 0; }
  table_exists="$(postgres_query "$container" "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '$POSTGRES_SCHEMA' AND table_name = 'apple333_deployment_metadata')")" || { printf 'UNREACHABLE'; return 0; }
  if [[ "$table_exists" == "t" ]]; then
    metadata="$(postgres_query "$container" "SELECT project_id || '|' || install_id || '|' || environment || '|' || status FROM \"$POSTGRES_SCHEMA\".apple333_deployment_metadata WHERE id = 1")" || { printf 'UNREACHABLE'; return 0; }
    if [[ "$metadata" == "$PROJECT_KEY|${APPLE333_INSTALL_ID:-}|$APPLE333_ENVIRONMENT|active" ]]; then
      printf 'OWNED_CURRENT'
    elif [[ "$metadata" == "$PROJECT_KEY|"* ]]; then
      printf 'OWNED_OTHER_APPLE333'
    else
      printf 'FOREIGN'
    fi
    return 0
  fi
  table_count="$(postgres_query "$container" "SELECT count(*) FROM information_schema.tables WHERE table_schema = '$POSTGRES_SCHEMA' AND table_type = 'BASE TABLE'")" || { printf 'UNREACHABLE'; return 0; }
  [[ "$table_count" == "0" ]] && printf 'EMPTY' || printf 'FOREIGN'
}

write_state_marker() {
  mkdir -p "$APPLE333_STATE_DIR" "$APPLE333_BACKUP_DIR"
  chmod 700 "$APPLE333_STATE_DIR" "$APPLE333_BACKUP_DIR" || warn "Could not restrict state/backup directories"
  umask 077
  cat > "$STATE_FILE" <<EOF
PROJECT_ID=$PROJECT_KEY
INSTALL_ID=$APPLE333_INSTALL_ID
ENVIRONMENT=$APPLE333_ENVIRONMENT
COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME
INSTALL_ROOT=$REPO_ROOT
DATABASE_NAME=$POSTGRES_DB
DATABASE_SCHEMA=$POSTGRES_SCHEMA
CREATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
  chmod 600 "$STATE_FILE"
}

record_deployed_at() {
  [[ -f "$STATE_FILE" ]] || return 0
  local updated
  updated="$(mktemp "$APPLE333_STATE_DIR/.${APPLE333_ENVIRONMENT}.state.XXXXXX")"
  sed '/^LAST_DEPLOYED_AT=/d' "$STATE_FILE" > "$updated"
  printf 'LAST_DEPLOYED_AT=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$updated"
  chmod 600 "$updated"
  mv "$updated" "$STATE_FILE"
}

acquire_deploy_lock() {
  require_command flock
  mkdir -p "$APPLE333_STATE_DIR"
  chmod 700 "$APPLE333_STATE_DIR" || true
  # File descriptor 9 stays open for the rest of the invoking script.
  exec 9>"$APPLE333_STATE_DIR/.${APPLE333_ENVIRONMENT}.deploy.lock"
  flock -n 9 || die "Another Apple333 deployment operation is already running for $APPLE333_ENVIRONMENT"
}

set_database_marker_status() {
  local status="$1" container
  [[ "$status" =~ ^(installing|active|failed|uninstalling)$ ]] || die "Invalid database marker status"
  container="$(postgres_container_id)"
  [[ -n "$container" ]] || die "Managed PostgreSQL container was not found"
  postgres_query "$container" "CREATE SCHEMA IF NOT EXISTS \"$POSTGRES_SCHEMA\"; CREATE TABLE IF NOT EXISTS \"$POSTGRES_SCHEMA\".apple333_deployment_metadata (id smallint PRIMARY KEY CHECK (id = 1), project_id text NOT NULL, install_id text NOT NULL, environment text NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()); INSERT INTO \"$POSTGRES_SCHEMA\".apple333_deployment_metadata (id, project_id, install_id, environment, status) VALUES (1, '$PROJECT_KEY', '$APPLE333_INSTALL_ID', '$APPLE333_ENVIRONMENT', '$status') ON CONFLICT (id) DO UPDATE SET project_id = EXCLUDED.project_id, install_id = EXCLUDED.install_id, environment = EXCLUDED.environment, status = EXCLUDED.status, updated_at = now();" >/dev/null
}

backup_database() {
  local container timestamp output
  container="$(postgres_container_id)"
  [[ -n "$container" ]] || die "Cannot back up: managed PostgreSQL container was not found"
  mkdir -p "$APPLE333_BACKUP_DIR"
  chmod 700 "$APPLE333_BACKUP_DIR" || true
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  output="$APPLE333_BACKUP_DIR/${APPLE333_ENVIRONMENT}-${POSTGRES_DB}-${timestamp}.dump"
  umask 077
  docker exec -e "PGPASSWORD=$POSTGRES_PASSWORD" "$container" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$output"
  [[ -s "$output" ]] || die "Database backup file is empty: $output"
  log "Created database backup: $output"
}

wait_for_service_health() {
  local service="$1" attempts="${2:-30}" container health
  container="$(compose ps -q "$service")"
  [[ -n "$container" ]] || die "Service container was not created: $service"
  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)"
    [[ "$health" == "healthy" || "$health" == "running" ]] && return 0
    sleep 2
  done
  die "Service did not become healthy: $service"
}

wait_for_readiness() {
  require_command curl
  local host="127.0.0.1" attempt
  for ((attempt = 1; attempt <= 30; attempt += 1)); do
    if curl --fail --silent --show-error "http://$host:$APPLE333_HTTP_PORT/api/ready" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  die "Apple333 readiness endpoint did not become healthy"
}

confirm_typed() {
  local expected="$1" prompt="$2" answer
  [[ -t 0 ]] || die "Destructive confirmation requires an interactive terminal"
  printf '%s\n' "$prompt" >&2
  read -r -p "Type exactly: $expected: " answer
  [[ "$answer" == "$expected" ]] || die "Confirmation did not match; no resource was deleted"
}
