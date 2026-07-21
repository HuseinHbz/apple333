# Phase 05.1.1 - Module 08: Dependency final review

**Review date:** 2026-07-20
**Scope:** production dependency advisory decision and lockfile/source review
**Network/package installation performed in this module:** one read-only production advisory query; no package install or dependency change
**Decision status:** Option B proposal only - **not an approved risk acceptance**

## Executive decision

The known PostCSS and uuid advisories are not silently accepted. A safe upgrade (Option A) was not attempted in this documentation-only module because the vulnerable packages are transitive compatibility concerns for Next.js, NextAuth, and Sentry. A time-bounded **Option B** is documented below, but it cannot become active until two named human owners accept it and a fresh audit is attached. Until then, the open Moderate findings remain a release gate.

A fresh `pnpm audit --prod --json` was run on 2026-07-20. It is a read-only registry advisory query; it did not install, upgrade, remove, or modify a package. The exit code was `1`, as expected when advisories are present. The result is recorded below and does not activate Option B without named human owners.

## Evidence status

| Evidence | Date / source | Result | Limitation |
| --- | --- | --- | --- |
| Fresh production audit | Local `pnpm audit --prod --json`, 2026-07-20 | Exit `1`; **0 Critical, 0 High, 2 Moderate**. Records: `GHSA-qx2v-qp2m-jg93` and `GHSA-w5hq-g745-h8pq`. | A registry advisory report is not a dependency upgrade, compatibility test, or owner approval. |
| CI audit verifier | `scripts/verify-production-dependency-audit.mjs` and `security.yml` working-tree review | CI retains the full JSON artifact, fails closed for malformed output/High/Critical findings, and reports Moderate findings without suppression. | No GitHub Actions run exists for this working tree. |
| Current manifest | `package.json` reviewed locally | Runtime dependencies include Next `15.5.18`, NextAuth `^4.24.14`, and Sentry `10.65.0`; no dependency was changed by this module. | A manifest cannot establish advisory status. |
| Current lock snapshot | `pnpm-lock.yaml` reviewed locally | Contains `postcss@8.5.3`, `postcss@8.4.31`, `uuid@8.3.2`, and `next-auth@4.24.14`. | Lock inspection is not an advisory database scan. |
| Source scope | Phase 05.1 security review | No direct `uuid` import was found under `src/`, `scripts/`, or `tests/`. | A lack of direct import does not remove transitive risk. |

The current dirty working tree contains unrelated prior work. The `package.json` diff against the branch base shows added development tooling and script changes, not a deliberate production-dependency remediation. This review does not assert lockfile provenance or frozen-install reproducibility.

## Findings

| Advisory | Resolved path recorded in prior audit | Severity | Patched version reported in prior audit | Impact analysis |
| --- | --- | --- | --- | --- |
| [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) - PostCSS CSS stringify XSS | `postcss@8.5.3` through Sentry/webpack paths; `postcss@8.4.31` through Next.js / NextAuth paths | Moderate | `>=8.5.10` | Reviewed storefront UI renders catalog content through React and escapes `<` in JSON-LD, so no known application CSS-stringify call was identified. Build/plugin behavior and future attacker-controlled CSS paths remain in scope; impact is not treated as zero. |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) - uuid buffer bounds check | `uuid@8.3.2` through `next-auth@4.24.14` | Moderate | `>=11.1.1` | No direct application `uuid` import was previously found, but the NextAuth dependency remains production-reachable. Authentication/session behavior is security-sensitive, so the absence of a direct import is not a mitigation. |

## Option A assessment: safe upgrade

**Not executed.** A direct PostCSS edit alone would not remediate all paths, and a uuid resolution likely requires a compatible NextAuth/upstream update. Changing either tree must be isolated because it can affect:

- Next.js build, CSS processing, image/static output, and Sentry webpack integration;
- NextAuth database sessions, cookies, credentials login, callbacks, and admin RBAC; and
- reproducibility of the production lockfile and deployment artifact.

Option A is the preferred final outcome, but it needs a dedicated branch, frozen install, reviewed dependency/lockfile diff, and passing typecheck, lint, production build, unit, integration, seeded E2E, and staging auth/store smoke evidence. None of that was claimed or performed here.

## Option B: proposed time-bounded risk acceptance

| Field | Required value / current status |
| --- | --- |
| Decision | Temporary acceptance of only the two advisory records above; **pending approval**. |
| Security owner | **Unassigned.** A named individual, not merely a role, must approve. |
| Platform/release owner | **Unassigned.** A named individual, not merely a role, must co-approve. |
| Review date | On or before **2026-08-20**. |
| Hard expiry | **2026-10-18**. |
| Immediate revocation | Any High/Critical advisory, changed advisory path/count, confirmed exploit path, supported compatible upstream fix, failed compatibility test, or expiry. |
| Release status until owners approve | Not accepted; the Moderates remain open and this report does not authorize production deployment. |

If a named security owner and named platform/release owner approve the exception, its scope must remain limited to the exact two advisory identifiers, resolved paths, and dates in this document. It must not cover a new dependency, a changed lockfile, a future direct PostCSS/uuid use, or a changed authentication implementation.

## Controls and remediation plan

| Deadline | Action | Acceptance evidence |
| --- | --- | --- |
| Before any release that relies on Option B | Run `pnpm audit --prod --json` from a clean, frozen dependency state; record only redacted output and severity totals. | Audit is still 0 High/0 Critical; advisory list exactly matches this review; two named owners approve or release is blocked. |
| 2026-08-20 | Re-evaluate supported Next.js, NextAuth, Sentry, PostCSS, and uuid upgrade paths. | Candidate version/lockfile diff, upstream compatibility notes, and named reviewers. |
| 2026-09-18 | Validate the smallest compatible remediation in an isolated branch/environment. | Frozen install, typecheck, lint, production build, unit/integration/E2E results, plus focused login/session/storefront smoke evidence. |
| Before 2026-10-18 | Merge a reviewed remediation or stop releases relying on the exception. | Fresh audit without the affected finding or a new formally approved decision after full review. |

The following are explicitly prohibited as a substitute for remediation:

- `--no-audit`, advisory suppression, or a lockfile-only override without compatibility analysis;
- pinning a known-vulnerable package;
- changing the lockfile or production dependency versions in this phase without the required tests; and
- copying the prior audit result into a future release without rerunning it.

## Required release checklist

1. Use a clean checkout and `pnpm install --frozen-lockfile`.
2. Run `pnpm audit --prod --json` with no credentials or production configuration present in command output/artifacts.
3. Attach the date, command exit code, total counts, advisory IDs, and affected dependency paths.
4. Block on any High/Critical result. For every Moderate, document a named owner, impact, review date, expiry, and remediation work item.
5. Revoke this proposal if the result differs from the two recorded findings.

## Conclusion

Option B is fully documented but intentionally **not activated** because the required named human owners have not accepted the risk. The fresh audit confirms the same two Moderate records and no High/Critical record, but it is not owner approval. Dependency approval is therefore **not complete** and does not contribute to a Phase 05.1.1 production-ready score.
