import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { assessProductionAuditReport } from '../../scripts/verify-production-dependency-audit.mjs';

function auditReport(counts: Record<string, number>) {
  return {
    metadata: {
      vulnerabilities: {
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0,
        info: 0,
        ...counts,
        ...(counts.total === undefined ? {} : { total: counts.total }),
      },
    },
    advisories: {
      12345: { github_advisory_id: 'GHSA-example-1234' },
    },
  };
}

describe('production dependency audit verification', () => {
  it('reports Moderate findings without silently suppressing them', () => {
    expect(assessProductionAuditReport(auditReport({ moderate: 2 }), 1)).toEqual({
      ok: true,
      errors: [],
      summary: { critical: 0, high: 0, moderate: 2, low: 0, info: 0, total: 2 },
      advisories: ['GHSA-example-1234'],
    });
  });

  it('fails closed for High or Critical findings', () => {
    expect(assessProductionAuditReport(auditReport({ high: 1 }), 1)).toEqual(expect.objectContaining({
      ok: false,
      errors: ['Production dependency audit found critical=0, high=1.'],
    }));
  });

  it('fails closed for a malformed or unexpected audit response', () => {
    expect(assessProductionAuditReport({ error: { code: 'ERR_PNPM_AUDIT_BAD_RESPONSE' } }, 1)).toEqual(expect.objectContaining({
      ok: false,
      errors: ['Audit JSON does not contain metadata.vulnerabilities.'],
    }));
    expect(assessProductionAuditReport(auditReport({}), 2)).toEqual(expect.objectContaining({
      ok: false,
      errors: ['pnpm audit exited unexpectedly with code 2.'],
    }));
  });

  it('accepts a UTF-8 BOM audit artifact produced by Windows PowerShell', async () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'apple333-audit-'));
    const reportPath = join(temporaryDirectory, 'audit.json');
    writeFileSync(reportPath, `\uFEFF${JSON.stringify(auditReport({ moderate: 1 }))}`, 'utf8');

    try {
      const verifier = await import('../../scripts/verify-production-dependency-audit.mjs');
      // Exercise the script path through a child process so the test confirms
      // file parsing, rather than only the pure report assessor.
      const { spawnSync } = await import('node:child_process');
      const result = spawnSync(process.execPath, [
        'scripts/verify-production-dependency-audit.mjs',
        reportPath,
      ], {
        cwd: process.cwd(),
        env: { ...process.env, PNPM_AUDIT_EXIT_CODE: '1' },
        encoding: 'utf8',
      });

      expect(verifier.assessProductionAuditReport).toBeTypeOf('function');
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('critical=0 high=0 moderate=1');
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
