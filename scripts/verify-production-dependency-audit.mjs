import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEVERITIES = ['critical', 'high', 'moderate', 'low', 'info'];

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function count(value, severity) {
  const candidate = value?.[severity];
  if (!Number.isSafeInteger(candidate) || candidate < 0) {
    throw new Error(`Audit metadata is missing a valid ${severity} vulnerability count.`);
  }
  return candidate;
}

function advisoryIdentifiers(report) {
  if (!isRecord(report.advisories)) return [];

  return Object.entries(report.advisories)
    .flatMap(([key, advisory]) => {
      if (!isRecord(advisory)) return [key];
      const identifier = advisory.github_advisory_id ?? advisory.url ?? advisory.title ?? key;
      return typeof identifier === 'string' ? [identifier] : [key];
    })
    .sort();
}

/**
 * Validates the complete JSON emitted by `pnpm audit --prod --json`.
 *
 * A non-zero pnpm exit code is normal when an advisory exists, so the caller
 * must preserve that code and let this function make the explicit severity
 * decision. Missing/malformed audit JSON and unexpected process failures fail
 * closed; Moderate findings are reported but never suppressed.
 */
export function assessProductionAuditReport(report, pnpmExitCode) {
  if (!Number.isSafeInteger(pnpmExitCode) || ![0, 1].includes(pnpmExitCode)) {
    return {
      ok: false,
      errors: [`pnpm audit exited unexpectedly with code ${String(pnpmExitCode)}.`],
      summary: null,
      advisories: [],
    };
  }

  try {
    if (!isRecord(report) || !isRecord(report.metadata) || !isRecord(report.metadata.vulnerabilities)) {
      throw new Error('Audit JSON does not contain metadata.vulnerabilities.');
    }

    const vulnerabilities = report.metadata.vulnerabilities;
    const summary = Object.fromEntries(SEVERITIES.map((severity) => [severity, count(vulnerabilities, severity)]));
    const computedTotal = Object.values(summary).reduce((total, value) => total + value, 0);
    // pnpm's audit JSON currently omits `total`; npm-style reports may include
    // it. Accept both shapes while rejecting a contradictory explicit total.
    const reportedTotal = vulnerabilities.total;
    if (reportedTotal !== undefined && (!Number.isSafeInteger(reportedTotal) || reportedTotal < 0 || reportedTotal !== computedTotal)) {
      throw new Error('Audit metadata has an invalid total vulnerability count.');
    }
    const total = reportedTotal ?? computedTotal;
    summary.total = total;

    const errors = [];
    if (pnpmExitCode === 1 && total === 0) {
      errors.push('pnpm audit returned code 1 but reported no vulnerabilities.');
    }
    if (summary.critical > 0 || summary.high > 0) {
      errors.push(`Production dependency audit found critical=${summary.critical}, high=${summary.high}.`);
    }

    return { ok: errors.length === 0, errors, summary, advisories: advisoryIdentifiers(report) };
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : 'Could not validate audit JSON.'],
      summary: null,
      advisories: [],
    };
  }
}

function readAuditFile(pathname) {
  if (!pathname) {
    throw new Error('Usage: node scripts/verify-production-dependency-audit.mjs <audit-report.json>');
  }

  const reportPath = resolve(pathname);
  if (!existsSync(reportPath)) {
    throw new Error(`Audit report does not exist: ${reportPath}`);
  }

  try {
    return JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch {
    throw new Error(`Audit report is not valid JSON: ${reportPath}`);
  }
}

function main() {
  const rawExitCode = process.env.PNPM_AUDIT_EXIT_CODE;
  if (!rawExitCode || !/^(?:0|1)$/.test(rawExitCode)) {
    throw new Error('PNPM_AUDIT_EXIT_CODE must be the captured pnpm audit exit code (0 or 1).');
  }

  const result = assessProductionAuditReport(readAuditFile(process.argv[2]), Number(rawExitCode));
  if (!result.ok || !result.summary) {
    throw new Error(`Production dependency audit verification failed: ${result.errors.join(' ')}`);
  }

  const { critical, high, moderate, low, info, total } = result.summary;
  console.log(`Production dependency audit: critical=${critical} high=${high} moderate=${moderate} low=${low} info=${info} total=${total}`);
  if (result.advisories.length > 0) {
    console.log(`Reported advisories: ${result.advisories.join(', ')}`);
  }
  if (moderate > 0) {
    console.warn('Moderate advisories remain open and require the documented owner, review date, and expiry; they were not suppressed.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Production dependency audit verification failed.');
    process.exitCode = 1;
  }
}
