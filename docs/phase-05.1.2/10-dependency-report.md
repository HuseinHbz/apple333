# Phase 05.1.2 — Module 10: Dependency decision report

**Status:** **INCOMPLETE — findings are measured; no named risk owners have approved an exception**
**Audit date:** 2026-07-20
**Command:** `pnpm audit --prod --json`
**Command effect:** read-only registry advisory lookup; no dependency install, upgrade, removal, database, staging, or production action

## Fresh audit result

The command exited with code `1`, which is expected because advisories are
present. Its severity totals are:

| Critical | High | Moderate | Low | Info |
| ---: | ---: | ---: | ---: | ---: |
| 0 | 0 | 2 | 0 | 0 |

No High or Critical production dependency advisory was reported. Two Moderate
records remain and are not silently suppressed.

| Advisory | Resolved production path | Patched range | Impact / current decision |
| --- | --- | --- | --- |
| [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) — PostCSS CSS stringify XSS | `postcss@8.5.3` via Sentry/webpack and `postcss@8.4.31` via Next.js/NextAuth | `>=8.5.10` | Moderate. React rendering and JSON-LD escaping reduce known application exposure, but plugin/build and future attacker-controlled CSS paths are not treated as zero risk. |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) — uuid buffer bounds check | `uuid@8.3.2` via `next-auth@4.24.14` | `>=11.1.1` | Moderate. No direct app import was found, but NextAuth is production-reachable and authentication is security-sensitive. |

## Decision

Option A (safe upgrade) was not executed in this evidence-only phase. A
dependency/lockfile update could affect Next.js build output, Sentry webpack
integration, and NextAuth sessions/cookies/RBAC. It requires a dedicated
reviewed change plus full regression and staging evidence.

Option B (time-bounded risk acceptance) is **not active**. The required human
fields are not available in this task and must not be invented:

| Required field | Status |
| --- | --- |
| Named security owner | Unassigned |
| Named platform/release owner | Unassigned |
| Review date | Proposed: 2026-08-20, pending owner acceptance |
| Hard expiry | Proposed: 2026-10-18, pending owner acceptance |
| Exact advisory scope | Limited to the two records above if approved |
| Immediate revocation | Any High/Critical finding, path/count change, confirmed exploit path, supported compatible upstream fix, failed compatibility test, or expiry |

## Required next step

A named security owner and a named platform/release owner must either:

1. approve the exact Option B scope, review date, and expiry above; or
2. authorize an isolated Option A dependency-upgrade branch with frozen install,
   typecheck, lint, build, unit/integration/E2E, and staging auth/store smoke
   evidence.

Until one of those decisions exists, Module 10 is **not approved** and cannot
contribute to a Phase 05.1.2 release approval.
