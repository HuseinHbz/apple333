import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const readDeploy = (path: string) => readFileSync(resolve(root, 'deploy', path), 'utf8');
const readRoot = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('deployment safety assets', () => {
  it('documents the mandatory deployment-maintenance rule', () => {
    const rule = readDeploy('MAINTENANCE_RULE.md');

    expect(rule).toContain('Every project change must review `deploy/`');
    expect(rule).toContain('Prisma schema, migrations');
  });

  it('uses explicit ownership labels and keeps data services off host ports', () => {
    const compose = readDeploy('compose.production.yml');

    expect(compose).toContain('com.apple333.project');
    expect(compose).toContain('com.apple333.install-id');
    expect(compose).toContain('postgres_data:/var/lib/postgresql/data');
    const postgresBlock = compose.split('\n  redis:')[0] ?? '';
    const redisBlock = (compose.split('\n  redis:')[1] ?? '').split('\n  app:')[0] ?? '';
    expect(postgresBlock).not.toContain('ports:');
    expect(redisBlock).not.toContain('ports:');
    expect(compose).toContain('minio:');
    expect(compose).toContain('migrate:');
    expect(compose).toContain('METRICS_ENABLED: "true"');
    expect(compose).toContain('egress:');
    expect(compose).toContain('mem_limit:');
    expect(compose).toContain('/api/ready');
  });

  it('keeps destructive operations opt-in and rejects shared database URLs', () => {
    const library = readDeploy('bin/lib.sh');
    const uninstall = readDeploy('bin/uninstall.sh');
    const preflight = readDeploy('bin/preflight.sh');
    const purgeUnrelated = readDeploy('bin/purge-unrelated.sh');

    expect(library).toContain('This managed deployment bundle only supports its labelled postgres service');
    expect(library).toContain('confirm_typed');
    expect(uninstall).toContain('--purge-owned-data');
    expect(uninstall).not.toContain('compose down -v');
    expect(preflight).toContain('Nothing was changed.');
    expect(library).toContain('load_environment_file');
    expect(library).toContain('REDIS_PASSWORD must be a shell-safe value');
    expect(library).toContain('APPLE333_HTTP_BIND must be loopback-only');
    expect(library).toContain('$(basename "$output")');
    expect(purgeUnrelated).toContain('OWNED_CURRENT|OWNED_OTHER_APPLE333');
  });

  it('keeps one canonical Compose definition and uses a non-root production image', () => {
    const conventionalEntrypoint = readRoot('docker-compose.production.yml');
    const dockerfile = readRoot('docker/Dockerfile.production');

    expect(conventionalEntrypoint).toContain('deploy/compose.production.yml');
    expect(dockerfile).toContain('FROM base AS builder');
    expect(dockerfile).toContain('FROM base AS migrator');
    expect(dockerfile).toContain('USER nextjs');
    expect(dockerfile).toContain('dumb-init');
  });

  it('uses the reviewed migration image and trusted client addressing', () => {
    const library = readDeploy('bin/lib.sh');
    const install = readDeploy('bin/install.sh');
    const update = readDeploy('bin/update.sh');
    const nginx = readDeploy('nginx.production.conf');

    expect(library).toContain('build_release_images');
    expect(library).toContain('run_prisma');
    expect(library).toContain('require_phase_04_1_pim_baseline_approval');
    expect(install).toContain('require_phase_04_1_pim_baseline_approval');
    expect(update).toContain('require_phase_04_1_pim_baseline_approval');
    expect(nginx).toContain('real_ip_header X-Forwarded-For');
    expect(nginx).toContain('limit_req_zone $binary_realip_remote_addr');
    expect(nginx).toContain('proxy_set_header X-Forwarded-For $realip_remote_addr');
  });

  it('hard-blocks the Phase 04.1 PIM baseline before any deployment mutation', () => {
    const library = readDeploy('bin/lib.sh');
    const install = readDeploy('bin/install.sh');
    const update = readDeploy('bin/update.sh');
    const readme = readDeploy('README.md');
    const safetyPolicy = readDeploy('SAFETY-POLICY.md');
    const envTemplate = readDeploy('.env.production.example');
    const releaseGates = readDeploy('RELEASE-GATES.md');
    const gateStart = library.indexOf('require_phase_04_1_pim_baseline_approval()');
    const gateEnd = library.indexOf('\n}\n', gateStart);
    const gate = library.slice(gateStart, gateEnd);

    expect(gate).toContain('No environment variable, command flag, or state-file edit');
    expect(gate).not.toContain('APPLE333_APPROVE_PIM_BASELINE_MIGRATION');
    expect(envTemplate).not.toContain('APPLE333_APPROVE_PIM_BASELINE_MIGRATION');
    expect(readme).toContain('hard-blocks it');
    expect(safetyPolicy).toContain('test/CI-only and hard-blocked by this');
    expect(releaseGates).toContain('**BLOCKED**');

    for (const script of [install, update]) {
      const guard = script.indexOf('require_phase_04_1_pim_baseline_approval');

      expect(guard).toBeGreaterThanOrEqual(0);
      expect(guard).toBeLessThan(script.indexOf('compose up -d'));
      expect(guard).toBeLessThan(script.indexOf('build_release_images'));
      expect(guard).toBeLessThan(script.indexOf('run_prisma migrate deploy'));
    }
  });

  it('requires verified container, schema, and core-volume ownership', () => {
    const library = readDeploy('bin/lib.sh');
    const preflight = readDeploy('bin/preflight.sh');
    const install = readDeploy('bin/install.sh');
    const update = readDeploy('bin/update.sh');

    expect(library).toContain('compose_container_classification');
    expect(library).toContain('docker container inspect -f');
    expect(library).toContain('com.apple333.environment');
    expect(library).toContain('state_install_id');
    expect(library).toContain('t.typrelid = 0');
    expect(library).toContain('RECOVERY_REQUIRED');
    expect(preflight).toContain('--assert-pristine-after-start');
    expect(preflight).toContain('"$postgres_volume_status" "$redis_volume_status" "$minio_volume_status"');
    expect(preflight).toContain('update.sh will not initialize replacement data');
    expect(install).toContain('preflight.sh" --assert-pristine-after-start');
    expect(update).toContain('preflight.sh" --assert-owned');
    expect(update).toContain('Database marker no longer proves ownership of this running deployment');
  });

  it('keeps migration updates backup-first and deployment scripts free of broad database commands', () => {
    const library = readDeploy('bin/lib.sh');
    const update = readDeploy('bin/update.sh');
    const workflow = readRoot('.github/workflows/quality.yml');
    const scripts = [
      'bin/install.sh',
      'bin/update.sh',
      'bin/uninstall.sh',
      'bin/preflight.sh',
      'bin/purge-unrelated.sh',
    ].map(readDeploy).join('\n');

    expect(update.indexOf('backup_database')).toBeLessThan(update.indexOf('set_database_marker_status installing'));
    expect(update.indexOf('set_database_marker_status installing')).toBeLessThan(update.indexOf('run_prisma migrate status'));
    expect(update.indexOf('run_prisma migrate status')).toBeLessThan(update.indexOf('run_prisma migrate deploy'));
    expect(library).toContain('require_command sha256sum');
    expect(library).toContain('sha256sum --check');
    expect(scripts).not.toMatch(/run_prisma\s+db\s+push/);
    expect(scripts).not.toMatch(/run_prisma\s+migrate\s+reset/);
    expect(scripts).not.toMatch(/^\s*docker\s+system\s+prune/m);
    expect(scripts).not.toMatch(/^\s*docker\s+compose.*\sdown\s+-v/m);
    expect(workflow).toContain('bash -n deploy/bin/*.sh');
  });
});
