# Phase 06.1.1 — Dependency Security Closure

**Scope:** local dependency analysis only. No production system, credential,
database, migration, deployment, or runtime secret was accessed.

## Decision

The production dependency gate is **PASS** for High and Critical severity.
The locked dependency graph is intentionally kept on the existing Next.js and
Prisma major versions.

## Remediation applied

The package manager is pnpm and the repository maintains a single
`pnpm-lock.yaml`. Patch-compatible pnpm overrides were recorded for:

| Dependency | Locked remediation |
| --- | --- |
| `next` / `eslint-config-next` | `15.5.21` |
| `next-auth` | `4.24.15` |
| `@auth/prisma-adapter` | `2.11.3` |
| `@auth/core` | `0.41.3` |
| `brace-expansion` | `5.0.8` |
| `fast-uri` | `3.1.4` |
| `sharp` | `0.35.0` |
| `postcss` | `8.5.18` |

The lockfile was regenerated with pnpm and verified with a frozen install.
No package was removed, and neither Next.js nor Prisma received a major
upgrade.

## Audit evidence

Command:

```text
pnpm audit --prod --json
pnpm audit --prod --audit-level=high
```

Result on 2026-07-29:

| Severity | Count | Gate result |
| --- | ---: | --- |
| Critical | 0 | Pass |
| High | 0 | Pass |
| Moderate | 0 | Pass |

## Registry refresh and remediation

The first closure audit exposed newly published advisories for the previously
locked `next`, `next-auth`, `@auth/core`, `brace-expansion`, and `postcss`
versions. They were all resolved by compatible patch releases or a
transitive-package override; no major framework or Prisma upgrade was used.

The final `pnpm audit --prod --json` result is **0 Critical, 0 High, 0
Moderate, 0 Low**. No advisory is muted or accepted as an exception.

## Ongoing control

`.github/workflows/phase06-inventory-evidence.yml` runs the production audit
on each closure-branch push and pull request. It fails the security job for a
High or Critical finding and uploads the raw audit evidence for review.
