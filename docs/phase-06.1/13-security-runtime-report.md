# Phase 06.1 - Security Runtime Validation Report

**Evidence status:** **BLOCKED - runtime paths executed, dependency gate failed**
**Production resources touched:** No.

## Executed runtime security evidence

The isolated production-mode E2E and real PostgreSQL suites executed the
following security-relevant paths successfully:

| Area                                  | Runtime evidence                                                         |
| ------------------------------------- | ------------------------------------------------------------------------ |
| Unauthenticated protected admin pages | Redirect-to-login scenarios passed                                       |
| Public IMEI disclosure                | Raw IMEI absence scenario passed                                         |
| Authenticated device presentation/API | Masked identifier scenarios passed                                       |
| Protected inventory mutations         | Receipt, adjustment, transfer, reservation, and release scenarios passed |
| Branch-scoped mutation denial         | Passed in the real PostgreSQL suite                                      |
| Audit redaction                       | Passed in the real PostgreSQL suite                                      |
| Isolated app dependencies             | Readiness reported configuration, PostgreSQL, and Redis as `ok`          |

This is meaningful runtime evidence, but it is not a complete actor-by-actor
authorization matrix, rate-limit assessment, response-header review, or
formal penetration test. Those remaining scope gaps are recorded in
[08-rbac-runtime-report.md](08-rbac-runtime-report.md).

## Latest production dependency audit - blocked

The final `pnpm audit --prod --json` result dated 2026-07-22 reported:

```text
critical=0
high=2
moderate=3
```

The High findings include:

- `fast-uri` `3.1.3` through Sentry/webpack `schema-utils` paths; and
- `sharp` `0.34.5` through Next.js.

The Moderate findings include the PostCSS and `uuid` advisories, including the
reported duplicate PostCSS path. No advisory was suppressed, remediated, or
formally risk-accepted in this phase.

| Gate              | Result          |
| ----------------- | --------------- |
| Critical findings | PASS - 0        |
| High findings     | **BLOCKED - 2** |
| Moderate findings | **BLOCKED - 3** |

## Decision

Security acceptance is **not met**. Runtime checks passed for the exercised
paths, but the production dependency audit contains unresolved High and
Moderate findings. A compatible tested remediation or a formally approved
security risk decision is required before Phase 06.1 can be approved.
