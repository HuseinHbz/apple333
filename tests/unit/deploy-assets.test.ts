import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const readDeploy = (path: string) => readFileSync(resolve(root, 'deploy', path), 'utf8');

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
  });

  it('keeps destructive operations opt-in and rejects shared database URLs', () => {
    const library = readDeploy('bin/lib.sh');
    const uninstall = readDeploy('bin/uninstall.sh');
    const preflight = readDeploy('bin/preflight.sh');

    expect(library).toContain('This managed deployment bundle only supports its labelled postgres service');
    expect(library).toContain('confirm_typed');
    expect(uninstall).toContain('--purge-owned-data');
    expect(uninstall).not.toContain('compose down -v');
    expect(preflight).toContain('Nothing was changed.');
  });
});
