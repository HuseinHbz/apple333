import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  STAGING_COMPOSE_PROJECT,
  STAGING_DATABASE,
  STAGING_HTTP_PORT,
  STAGING_SCHEMA,
  STAGING_USER,
  parseStagingEnvironment,
  validateStagingCompose,
  validateStagingDeploymentSelector,
  validateStagingEnvironment,
} from '../../scripts/verify-staging-environment.mjs';

const root = process.cwd();
const template = readFileSync(resolve(root, 'deploy/.env.staging.example'), 'utf8');
const compose = readFileSync(resolve(root, 'deploy/compose.staging.yml'), 'utf8');
const deploymentLibrary = readFileSync(resolve(root, 'deploy/bin/lib.sh'), 'utf8');
const parsedTemplate = parseStagingEnvironment(template);

describe('staging deployment scaffolding', () => {
  it('accepts the non-secret staging template and isolated Compose strings without executing services', () => {
    expect(parsedTemplate.errors).toEqual([]);
    expect(validateStagingEnvironment(parsedTemplate.environment, { template: true })).toEqual({ ok: true, errors: [] });
    expect(validateStagingCompose(compose)).toEqual({ ok: true, errors: [] });
  });

  it('fails closed when a value would target a production-like deployment identity', () => {
    const result = validateStagingEnvironment({
      ...parsedTemplate.environment,
      APPLE333_ENVIRONMENT: 'production',
      COMPOSE_PROJECT_NAME: 'apple333-production',
      APPLE333_HTTP_PORT: '8080',
      APP_URL: 'https://apple333.ir',
      AUTH_URL: 'https://apple333.ir',
      NEXTAUTH_URL: 'https://apple333.ir',
      POSTGRES_DB: 'apple333',
      POSTGRES_SCHEMA: 'public',
      POSTGRES_USER: 'apple333',
      DATABASE_URL: 'postgresql://apple333:password@production-db:5432/apple333?schema=public',
      REDIS_URL: 'redis://:password@production-redis:6379',
    }, { template: true });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('APPLE333_ENVIRONMENT must be exactly staging.');
    expect(result.errors).toContain(`COMPOSE_PROJECT_NAME must be ${STAGING_COMPOSE_PROJECT}.`);
    expect(result.errors).toContain(`APPLE333_HTTP_PORT must be the isolated staging port ${STAGING_HTTP_PORT}.`);
    expect(result.errors).toContain('APP_URL must use a staging hostname and must not equal a production hostname.');
    expect(result.errors).toContain(`POSTGRES_DB must be ${STAGING_DATABASE}.`);
    expect(result.errors).toContain(`POSTGRES_SCHEMA must be ${STAGING_SCHEMA}; public is not permitted.`);
    expect(result.errors).toContain(`POSTGRES_USER must be ${STAGING_USER}.`);
    expect(result.errors).toContain('DATABASE_URL must target only the private staging postgres:5432 Compose service.');
    expect(result.errors).toContain('REDIS_URL must target only the private staging redis:6379 Compose service.');
  });

  it('rejects any accidental host publication for a staging data service', () => {
    const unsafeCompose = compose.replace(
      '    networks: [private]\n    shm_size: 256mb',
      '    ports:\n      - "5432:5432"\n    networks: [private]\n    shm_size: 256mb',
    );

    const result = validateStagingCompose(unsafeCompose);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('postgres must not publish a host port.');
  });

  it('requires the deployment library to select the staging Compose file through a closed mapping', () => {
    expect(validateStagingDeploymentSelector(deploymentLibrary)).toEqual({ ok: true, errors: [] });

    const unsafeLibrary = deploymentLibrary.replace(
      'staging) candidate="$DEPLOY_DIR/compose.staging.yml" ;;',
      'staging) candidate="$DEPLOY_DIR/compose.production.yml" ;;',
    );
    const result = validateStagingDeploymentSelector(unsafeLibrary);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Deployment selector is missing required closed-mapping fragment: staging) candidate="$DEPLOY_DIR/compose.staging.yml" ;;',
    );
  });
});
