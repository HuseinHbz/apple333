# Phase 05.1 — Dependency security review

## Decision summary

**Decision:** temporary, time-bounded **Option B — documented risk acceptance**
for the two current Moderate production dependency advisories. This is not a
silent ignore and not a production-security approval.

| Item | Decision |
| --- | --- |
| Review date | 2026-07-20 |
| Acceptance owners | Designated security owner and platform/release owner |
| Mandatory re-review | On or before **2026-08-20** |
| Hard expiry | **2026-10-18** |
| Automatic revocation | Affected advisory becomes High/Critical; an exploitable application path is identified; a supported fix becomes available and passes compatibility validation; or the hard expiry is reached. |

No package, lockfile, runtime dependency, production environment, or audit
suppression was modified for this review.

## Actual audit evidence

The following read-only command was run on 2026-07-20:

```bash
pnpm audit --prod --json
```

It returned exit code `1`, as expected when advisories are present. Its actual
`metadata.vulnerabilities` result was:

| Severity | Count |
| --- | ---: |
| Critical | **0** |
| High | **0** |
| Moderate | **2** |
| Low | 0 |
| Info | 0 |

The audit metadata reported 251 production dependencies, 115 optional
dependencies, and 366 total resolved dependencies. `--prod` does not mean every
finding is a direct application import; it reports production-reachable paths,
including optional paths. A later release must re-run the command rather than
copy this result forward.

## Findings

| Advisory | Current resolved package / path | Severity | Patched version | Scoped assessment |
| --- | --- | --- | --- | --- |
| [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) — PostCSS CSS Stringify XSS | `postcss@8.5.3` through `@sentry/nextjs` webpack paths; `postcss@8.4.31` through Next.js / next-auth paths | Moderate (CWE-79) | `>=8.5.10` | The reviewed storefront sends catalog text to React and escaped JSON-LD, not a known raw CSS-stringify call. That does not prove an exploit path is absent in plugin/build behavior or future code. |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) — uuid buffer bounds check | `uuid@8.3.2` through `next-auth@4.24.14` | Moderate (CWE-787, CWE-1285) | `>=11.1.1` | No direct `uuid` import was found in the scoped source search, but the package is transitively reachable through NextAuth. The risk is not therefore treated as zero. |

The audit identifies PostCSS paths through Next.js and NextAuth in addition to
the direct development declaration. A simple direct PostCSS-version edit would
not be a sufficient remediation.

## Why Option B is selected now

Option A — immediate upgrade — is not selected in this documentation-only
change because remediation crosses transitive compatibility boundaries:

- PostCSS remediation must account for versions carried by Next.js,
  `@sentry/nextjs`, and NextAuth, not only the direct development tool;
- uuid remediation likely requires a compatible upstream NextAuth dependency
  resolution, potentially including authentication/session regression risk; and
- Phase 05.1 requires measured staging evidence before any dependency upgrade
  is declared safe for storefront, admin session, build, and deployment paths.

This is a deferment with deadlines, not a conclusion that either advisory is
harmless. No `audit` suppression, override, lockfile edit, or exception flag
has been added.

## Risk-acceptance boundaries

The exception is valid only while all conditions below are true:

1. `pnpm audit --prod --json` remains at **0 High and 0 Critical**.
2. It covers only the two exact Moderate advisories and paths listed above; it
   does not cover new advisories, unrelated packages, or later findings.
3. No code is added that sends attacker-controlled data into a PostCSS CSS
   stringify/build path, or directly invokes vulnerable uuid namespace/buffer
   APIs, without a separate security review.
4. Authentication/session behavior, public storefront rendering, build,
   typecheck, lint, unit/integration tests, and staging E2E remain passing after
   any candidate upgrade.
5. Security and release owners re-run the audit and record a decision by
   2026-08-20. The exception ceases automatically on 2026-10-18 unless a new
   reviewed release decision exists.

If any condition fails, releases relying on this exception are blocked until
the finding is remediated or a new release-authorized decision is made.

## Remediation plan and acceptance criteria

| Deadline | Action | Required evidence |
| --- | --- | --- |
| 2026-08-20 | Re-run the production audit and inspect current supported upgrade paths for Next.js, NextAuth, Sentry, PostCSS, and uuid. | Non-secret audit output, proposed version/lockfile diff, compatibility notes, and named reviewers. |
| 2026-09-18 | Test the smallest compatible remediation in an isolated branch and non-production environment. | Frozen install, typecheck, lint, production build, unit/integration/E2E results, and focused auth/session/storefront smoke evidence. |
| Before 2026-10-18 | Merge a reviewed remediation or reject deployment under the expired exception. | Audit result with affected advisory removed/mitigated, security review, release approval, and staging evidence. |

Preferred remediation order:

1. Identify a supported framework/Sentry/NextAuth upgrade that lifts the
   transitive resolution without a manual override.
2. Validate the lockfile and all security-sensitive flows in isolated staging.
3. Consider a narrowly scoped resolution/override only after upstream
   compatibility analysis, explicit security approval, and reproducible CI
   evidence.
4. Do not use `--no-audit`, suppress the advisory, pin a known vulnerable
   version, or alter the lockfile without review.

## Ongoing controls

- Run `pnpm audit --prod --json` for every release candidate and record the
  date, exit result, and severity counts in release evidence.
- Treat any High/Critical result as a release blocker. Moderate results require
  a named issue/owner, impact review, expiry, and remediation plan.
- Re-check this exception whenever Next.js, NextAuth, Sentry, PostCSS, uuid,
  the lockfile, build pipeline, authentication flow, or externally sourced CSS
  behavior changes.
- Keep advisory output free of credential-bearing environment variables and do
  not attach production configuration to audit artifacts.

## Conclusion

The current dependency audit is below the Phase 05.1 requirement of zero
High/Critical findings, but it is not clean: two Moderate advisories remain
open. This narrow Option B exception expires on 2026-10-18 and does not grant
Phase 05.1 production acceptance. A verified compatible upgrade path and fresh
staging evidence are still required.
