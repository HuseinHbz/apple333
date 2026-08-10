import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const STAGING_COMPOSE_PROJECT = 'apple333-staging';
export const STAGING_DATABASE = 'apple333_staging';
export const STAGING_HTTP_PORT = '8081';
export const STAGING_SCHEMA = 'apple333_staging';
export const STAGING_USER = 'apple333_staging';

const requiredKeys = [
  'APPLE333_PROJECT_ID',
  'APPLE333_ENVIRONMENT',
  'COMPOSE_PROJECT_NAME',
  'APPLE333_INSTALL_ROOT',
  'APPLE333_STATE_DIR',
  'APPLE333_BACKUP_DIR',
  'APPLE333_HTTP_BIND',
  'APPLE333_HTTP_PORT',
  'NODE_ENV',
  'APP_NAME',
  'APP_URL',
  'AUTH_URL',
  'NEXTAUTH_URL',
  'AUTH_SECRET',
  'NEXTAUTH_SECRET',
  'APPLE333_APP_IMAGE',
  'POSTGRES_DB',
  'POSTGRES_SCHEMA',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'DATABASE_URL',
  'REDIS_PASSWORD',
  'REDIS_URL',
  'MINIO_ROOT_USER',
  'MINIO_ROOT_PASSWORD',
];

const secretKeys = [
  'AUTH_SECRET',
  'POSTGRES_PASSWORD',
  'REDIS_PASSWORD',
  'MINIO_ROOT_PASSWORD',
];

const productionHosts = new Set(['apple333.ir', 'www.apple333.ir']);

function hasPlaceholder(value) {
  return /replace-with|change-me|example|<[^>]+>|\$\{.+\}/i.test(value);
}

function isStagingHost(hostname) {
  return hostname.toLowerCase().split('.').includes('staging');
}

function secretValue(environment, key) {
  return typeof environment[key] === 'string' ? environment[key] : '';
}

function serviceBlock(composeSource, serviceName, followingServiceName) {
  const start = composeSource.indexOf(`  ${serviceName}:`);
  if (start < 0) return '';

  const end = followingServiceName
    ? composeSource.indexOf(`\n  ${followingServiceName}:`, start + 1)
    : composeSource.indexOf('\nnetworks:', start + 1);

  return composeSource.slice(start, end < 0 ? composeSource.length : end);
}

/**
 * Parses only plain KEY=value text. It neither expands values nor executes
 * shell syntax, so callers can validate protected files without loading them
 * into their process environment.
 */
export function parseStagingEnvironment(source) {
  const environment = {};
  const errors = [];

  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(rawLine.replace(/\r$/, ''));
    if (!match) {
      errors.push(`Environment line ${index + 1} must use a plain uppercase KEY=value assignment.`);
      continue;
    }

    const [, key, value] = match;
    if (Object.hasOwn(environment, key)) {
      errors.push(`Environment key ${key} is duplicated.`);
      continue;
    }
    environment[key] = value;
  }

  return { environment, errors };
}

/**
 * Validates in-memory strings only. It never opens a socket, imports Prisma,
 * starts Docker, executes Compose, runs a migration, or changes a file.
 */
export function validateStagingEnvironment(environment, { template = false } = {}) {
  const errors = [];

  for (const key of requiredKeys) {
    if (!secretValue(environment, key)) errors.push(`${key} is required.`);
  }

  if (environment.APPLE333_PROJECT_ID !== 'apple333-enterprise-platform') {
    errors.push('APPLE333_PROJECT_ID must be apple333-enterprise-platform.');
  }
  if (environment.APPLE333_ENVIRONMENT !== 'staging') {
    errors.push('APPLE333_ENVIRONMENT must be exactly staging.');
  }
  if (environment.COMPOSE_PROJECT_NAME !== STAGING_COMPOSE_PROJECT) {
    errors.push(`COMPOSE_PROJECT_NAME must be ${STAGING_COMPOSE_PROJECT}.`);
  }
  if (environment.APPLE333_INSTALL_ROOT !== '/opt/apple333-staging') {
    errors.push('APPLE333_INSTALL_ROOT must be the dedicated /opt/apple333-staging checkout.');
  }
  if (environment.APPLE333_STATE_DIR !== '/var/lib/apple333-staging') {
    errors.push('APPLE333_STATE_DIR must be /var/lib/apple333-staging.');
  }
  if (environment.APPLE333_BACKUP_DIR !== '/var/lib/apple333-staging/backups') {
    errors.push('APPLE333_BACKUP_DIR must be /var/lib/apple333-staging/backups.');
  }
  if (environment.APPLE333_HTTP_BIND !== '127.0.0.1') {
    errors.push('APPLE333_HTTP_BIND must be exactly the staging loopback address 127.0.0.1.');
  }
  if (environment.APPLE333_HTTP_PORT !== STAGING_HTTP_PORT) {
    errors.push(`APPLE333_HTTP_PORT must be the isolated staging port ${STAGING_HTTP_PORT}.`);
  }
  if (environment.NODE_ENV !== 'production') {
    errors.push('NODE_ENV must be production for the Next.js staging runtime.');
  }
  if (environment.APP_NAME !== 'Apple333 Staging') {
    errors.push('APP_NAME must be Apple333 Staging.');
  }
  if (!environment.APPLE333_APP_IMAGE?.startsWith('apple333/app:staging')) {
    errors.push('APPLE333_APP_IMAGE must use an apple333/app:staging image tag.');
  }

  validateApplicationUrls(environment, errors);
  validateDatabaseUrl(environment, errors);
  validateRedisUrl(environment, errors);
  validateObjectStorage(environment, errors);

  if (environment.POSTGRES_DB !== STAGING_DATABASE) {
    errors.push(`POSTGRES_DB must be ${STAGING_DATABASE}.`);
  }
  if (environment.POSTGRES_SCHEMA !== STAGING_SCHEMA) {
    errors.push(`POSTGRES_SCHEMA must be ${STAGING_SCHEMA}; public is not permitted.`);
  }
  if (environment.POSTGRES_USER !== STAGING_USER) {
    errors.push(`POSTGRES_USER must be ${STAGING_USER}.`);
  }
  if (!environment.MINIO_ROOT_USER?.includes('staging')) {
    errors.push('MINIO_ROOT_USER must be staging-specific.');
  }
  if (environment.SENTRY_ENVIRONMENT && environment.SENTRY_ENVIRONMENT !== 'staging') {
    errors.push('SENTRY_ENVIRONMENT must be staging when configured.');
  }
  if (environment.S3_BUCKET && !environment.S3_BUCKET.includes('staging')) {
    errors.push('S3_BUCKET must be staging-specific when configured.');
  }

  const installId = secretValue(environment, 'APPLE333_INSTALL_ID');
  if (!template && !/^[a-f0-9]{32}$/.test(installId)) {
    errors.push('APPLE333_INSTALL_ID must be a generated 32-character lowercase hexadecimal staging value.');
  }
  if (template && installId && !/^[a-f0-9]{32}$/.test(installId)) {
    errors.push('APPLE333_INSTALL_ID must be empty in the template or a 32-character lowercase hexadecimal staging value.');
  }

  if (environment.NEXTAUTH_SECRET !== environment.AUTH_SECRET) {
    errors.push('NEXTAUTH_SECRET must exactly match AUTH_SECRET for the current compatibility contract.');
  }
  for (const key of secretKeys) {
    const value = secretValue(environment, key);
    if (!template && hasPlaceholder(value)) {
      errors.push(`${key} must not contain a placeholder in a real staging environment file.`);
    }
    if (!template && value.length < 32) {
      errors.push(`${key} must be at least 32 characters in a real staging environment file.`);
    }
  }
  if (new Set(secretKeys.map((key) => secretValue(environment, key))).size !== secretKeys.length) {
    errors.push('AUTH_SECRET, PostgreSQL, Redis, and MinIO secrets must all be distinct staging values.');
  }

  return { ok: errors.length === 0, errors };
}

function validateApplicationUrls(environment, errors) {
  const appUrl = secretValue(environment, 'APP_URL');
  if (!appUrl) return;

  let parsed;
  try {
    parsed = new URL(appUrl);
  } catch {
    errors.push('APP_URL must be a valid HTTPS staging origin.');
    return;
  }

  if (parsed.protocol !== 'https:' || parsed.origin !== appUrl || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    errors.push('APP_URL must be an HTTPS origin without a path, query, fragment, or trailing slash.');
  }
  if (productionHosts.has(parsed.hostname) || !isStagingHost(parsed.hostname)) {
    errors.push('APP_URL must use a staging hostname and must not equal a production hostname.');
  }
  if (environment.AUTH_URL !== appUrl || environment.NEXTAUTH_URL !== appUrl) {
    errors.push('AUTH_URL and NEXTAUTH_URL must exactly match APP_URL.');
  }
}

function validateDatabaseUrl(environment, errors) {
  const databaseUrl = secretValue(environment, 'DATABASE_URL');
  if (!databaseUrl) return;

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    errors.push('DATABASE_URL must be a valid PostgreSQL URL.');
    return;
  }

  if (parsed.protocol !== 'postgresql:') errors.push('DATABASE_URL must use the postgresql: scheme.');
  if (parsed.hostname !== 'postgres' || parsed.port !== '5432') {
    errors.push('DATABASE_URL must target only the private staging postgres:5432 Compose service.');
  }
  if (parsed.username !== STAGING_USER) errors.push(`DATABASE_URL must use the ${STAGING_USER} role.`);
  if (decodeURIComponent(parsed.password) !== secretValue(environment, 'POSTGRES_PASSWORD')) {
    errors.push('DATABASE_URL must use POSTGRES_PASSWORD and no production/shared PostgreSQL credential.');
  }
  if (decodeURIComponent(parsed.pathname) !== `/${STAGING_DATABASE}`) {
    errors.push(`DATABASE_URL must target /${STAGING_DATABASE}.`);
  }
  if (parsed.searchParams.getAll('schema').length !== 1 || parsed.searchParams.get('schema') !== STAGING_SCHEMA) {
    errors.push(`DATABASE_URL must contain exactly one schema=${STAGING_SCHEMA} parameter.`);
  }
  if (parsed.hash) errors.push('DATABASE_URL must not contain a URL fragment.');
}

function validateRedisUrl(environment, errors) {
  const redisUrl = secretValue(environment, 'REDIS_URL');
  if (!redisUrl) return;

  let parsed;
  try {
    parsed = new URL(redisUrl);
  } catch {
    errors.push('REDIS_URL must be a valid Redis URL.');
    return;
  }

  if (parsed.protocol !== 'redis:') errors.push('REDIS_URL must use the redis: scheme.');
  if (parsed.hostname !== 'redis' || parsed.port !== '6379') {
    errors.push('REDIS_URL must target only the private staging redis:6379 Compose service.');
  }
  if (decodeURIComponent(parsed.password) !== secretValue(environment, 'REDIS_PASSWORD')) {
    errors.push('REDIS_URL must use REDIS_PASSWORD and no production/shared Redis credential.');
  }
  if (parsed.username || (parsed.pathname !== '' && parsed.pathname !== '/')) {
    errors.push('REDIS_URL must not include a username or database path.');
  }
}

function validateObjectStorage(environment, errors) {
  const endpoint = secretValue(environment, 'S3_ENDPOINT');
  const bucket = secretValue(environment, 'S3_BUCKET');
  const accessKey = secretValue(environment, 'S3_ACCESS_KEY');
  const secretKey = secretValue(environment, 'S3_SECRET_KEY');

  if (endpoint && endpoint !== 'http://minio:9000') {
    errors.push('S3_ENDPOINT must be empty or use only the private staging MinIO endpoint http://minio:9000.');
  }
  if (bucket && bucket !== 'apple333-staging') {
    errors.push('S3_BUCKET must be empty or exactly apple333-staging.');
  }
  if (Boolean(accessKey) !== Boolean(secretKey)) {
    errors.push('S3_ACCESS_KEY and S3_SECRET_KEY must either both be empty or both be staging-specific values.');
  }
  if (accessKey && (accessKey === secretValue(environment, 'MINIO_ROOT_USER') || secretKey === secretValue(environment, 'MINIO_ROOT_PASSWORD'))) {
    errors.push('Application S3 credentials must not reuse MinIO root credentials.');
  }
}

/**
 * Validates only expected literal fragments in the isolated Compose scaffold.
 * It intentionally does not call Docker or parse/interpolate a live config.
 */
export function validateStagingCompose(composeSource) {
  const errors = [];
  const requiredFragments = [
    'name: ${COMPOSE_PROJECT_NAME}',
    'com.apple333.project: ${APPLE333_PROJECT_ID}',
    'com.apple333.environment: ${APPLE333_ENVIRONMENT}',
    'com.apple333.install-id:',
    'POSTGRES_DB: ${POSTGRES_DB}',
    'POSTGRES_USER: ${POSTGRES_USER}',
    'REDIS_PASSWORD: ${REDIS_PASSWORD}',
    'MINIO_ROOT_USER: ${MINIO_ROOT_USER}',
    'MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}',
    'DATABASE_URL: ${DATABASE_URL}',
    'REDIS_URL: ${REDIS_URL}',
    '"${APPLE333_HTTP_BIND}:${APPLE333_HTTP_PORT}:80"',
    'name: ${COMPOSE_PROJECT_NAME}_postgres_data',
    'name: ${COMPOSE_PROJECT_NAME}_redis_data',
    'name: ${COMPOSE_PROJECT_NAME}_minio_data',
    'name: ${COMPOSE_PROJECT_NAME}_private',
    'name: ${COMPOSE_PROJECT_NAME}_egress',
  ];

  for (const fragment of requiredFragments) {
    if (!composeSource.includes(fragment)) errors.push(`Compose scaffold is missing required isolation fragment: ${fragment}`);
  }
  if (composeSource.includes('container_name:')) {
    errors.push('Compose scaffold must not use fixed container_name values.');
  }
  if (/\n\s*migrate:/m.test(composeSource)) {
    errors.push('Compose staging scaffold must not include an automatic migration service.');
  }

  const postgres = serviceBlock(composeSource, 'postgres', 'redis');
  const redis = serviceBlock(composeSource, 'redis', 'minio');
  const minio = serviceBlock(composeSource, 'minio', 'app');
  const nginx = serviceBlock(composeSource, 'nginx');
  for (const [service, block] of [['postgres', postgres], ['redis', redis], ['minio', minio]]) {
    if (!block) errors.push(`Compose scaffold is missing ${service} service.`);
    if (/\n\s+ports:/m.test(block)) errors.push(`${service} must not publish a host port.`);
  }
  if (!nginx || !nginx.includes('"${APPLE333_HTTP_BIND}:${APPLE333_HTTP_PORT}:80"')) {
    errors.push('nginx must be the only host-published staging service and must use the isolated loopback bind/port.');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Keeps the static staging verifier aligned with the deploy script's closed
 * environment-to-Compose mapping. This reads shell source only; it never
 * sources it or invokes Docker.
 */
export function validateStagingDeploymentSelector(librarySource) {
  const errors = [];
  const requiredFragments = [
    'select_compose_file()',
    'production) candidate="$DEPLOY_DIR/compose.production.yml" ;;',
    'staging) candidate="$DEPLOY_DIR/compose.staging.yml" ;;',
    'Unsupported managed deployment environment: $APPLE333_ENVIRONMENT',
    'select_compose_file',
  ];

  for (const fragment of requiredFragments) {
    if (!librarySource.includes(fragment)) {
      errors.push(`Deployment selector is missing required closed-mapping fragment: ${fragment}`);
    }
  }
  if (librarySource.includes('APPLE333_COMPOSE_FILE')) {
    errors.push('Deployment selector must not accept an arbitrary APPLE333_COMPOSE_FILE override.');
  }

  const loadEnvironment = librarySource.indexOf('load_environment()');
  const loadEnvironmentFile = librarySource.indexOf('  load_environment_file', loadEnvironment);
  const selectCall = librarySource.indexOf('  select_compose_file', loadEnvironment);
  if (loadEnvironment < 0 || loadEnvironmentFile < 0 || selectCall < loadEnvironmentFile) {
    errors.push('Deployment selector must run only after the protected environment file is parsed.');
  }

  return { ok: errors.length === 0, errors };
}

export function parseVerifierArguments(argumentsList) {
  const options = {
    composeFile: resolve(repositoryRoot, 'deploy/compose.staging.yml'),
    envFile: resolve(repositoryRoot, 'deploy/.env.staging.example'),
    help: false,
    template: false,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--help') {
      options.help = true;
    } else if (argument === '--template') {
      options.template = true;
    } else if (argument === '--env-file' || argument === '--compose-file') {
      const value = argumentsList[index + 1];
      if (!value) throw new Error(`${argument} requires a file path.`);
      if (argument === '--env-file') options.envFile = resolve(value);
      else options.composeFile = resolve(value);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (options.envFile.endsWith('.example')) options.template = true;
  return options;
}

function printUsage() {
  console.log('Usage: node scripts/verify-staging-environment.mjs [--template] [--env-file path] [--compose-file path]');
  console.log('This command validates files as strings only. It never invokes Docker, Prisma, migrations, or network connections.');
}

function isDirectExecution() {
  return Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  try {
    const options = parseVerifierArguments(process.argv.slice(2));
    if (options.help) {
      printUsage();
    } else {
      const parsedEnvironment = parseStagingEnvironment(readFileSync(options.envFile, 'utf8'));
      const environmentResult = validateStagingEnvironment(parsedEnvironment.environment, { template: options.template });
      const composeResult = validateStagingCompose(readFileSync(options.composeFile, 'utf8'));
      const selectorResult = validateStagingDeploymentSelector(
        readFileSync(resolve(repositoryRoot, 'deploy/bin/lib.sh'), 'utf8'),
      );
      const errors = [...parsedEnvironment.errors, ...environmentResult.errors, ...composeResult.errors, ...selectorResult.errors];

      if (errors.length) {
        console.error('Staging scaffolding validation failed (no deployment action was attempted):');
        for (const error of errors) console.error(`- ${error}`);
        process.exitCode = 1;
      } else {
        console.log('Staging scaffolding validation passed. Strings only; no Docker, network, database, migration, or deployment action was attempted.');
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Staging scaffolding validation failed.');
    process.exitCode = 1;
  }
}
