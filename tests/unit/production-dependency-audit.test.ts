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
});
