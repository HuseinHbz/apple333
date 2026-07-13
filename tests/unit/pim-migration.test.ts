import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd());
const migrationPath = resolve(
  repositoryRoot,
  'prisma/migrations/20260713000000_phase_04_1_pim_activation/migration.sql',
);

describe('Phase 04.1 PIM baseline migration', () => {
  it('is an add-only baseline with the required PIM tables', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toMatch(/CREATE TABLE "Brand"/);
    expect(migration).toMatch(/CREATE TABLE "CatalogProduct"/);
    expect(migration).toMatch(/CREATE TABLE "CatalogVariant"/);
    expect(migration).toMatch(/CREATE TABLE "ProductSku"/);
    expect(migration).toMatch(/CREATE TABLE "ProductImportBatch"/);
    expect(migration).toMatch(/CREATE TABLE "ProductImportRow"/);
    expect(migration).toMatch(/CREATE TABLE "ProductWorkflowEvent"/);
    expect(migration).toMatch(/"applyAttemptToken" TEXT/);
    expect(migration).toMatch(/"applyStartedAt" TIMESTAMP\(3\)/);
    expect(migration).toMatch(/CREATE INDEX "ProductImportBatch_status_applyStartedAt_idx"/);

    expect(migration).not.toMatch(/^\s*DROP\b/im);
    expect(migration).not.toMatch(/^\s*TRUNCATE\b/im);
    expect(migration).not.toMatch(/^\s*DELETE\b/im);
    expect(migration).not.toMatch(/^\s*ALTER\s+TABLE\b.*\bDROP\b/im);
  });

  it('uses only guarded Prisma deploy commands for the isolated target', async () => {
    const runner = await readFile(resolve(repositoryRoot, 'scripts/run-pim-test-migrations.mjs'), 'utf8');
    const inspector = await readFile(resolve(repositoryRoot, 'scripts/inspect-pim-test-database.mjs'), 'utf8');

    expect(runner).toContain("'migrate', 'deploy'");
    expect(runner).toContain("'migrate', 'status'");
    expect(runner).not.toContain('db push');
    expect(runner).not.toContain('migrate reset');
    expect(inspector).toContain('PHASE_04_1_MIGRATION');
    expect(inspector).toContain('public schema objects already exist');
  });
});
