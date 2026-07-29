# Phase 06.1.1 — CI Remediation Evidence

**Branch:** `feature/phase-06.1.1-inventory-production-approval-closure`
**Initial Phase 06.1.1 workflow run:** [30437744240](https://github.com/HuseinHbz/apple333/actions/runs/30437744240)

## Observed CI failure

The `Quality and Prisma static gates` job failed only because API fixture
requests used a hard-coded `http://localhost` origin while the workflow
declares `APP_URL=http://127.0.0.1:3000`. The application correctly compares
mutation origins against `APP_URL`, so these test requests were rejected with
HTTP 403 before their validation or authorization assertions ran.

The same environment-sensitive assumption existed in PIM, storefront,
sitemap, and request-security tests. It is a test-fixture defect, not a
production security defect.

## Remediation

- Integration request fixtures now derive their request URL and same-origin
  header from `process.env.APP_URL`, falling back to the canonical local app
  URL only when the environment does not define one.
- Sitemap expectations now derive canonical URLs from the same configuration.
- The request-security unit test explicitly stubs its public origin for its
  own isolated contract.
- No application authorization, CSRF, proxy, or origin-validation code was
  relaxed or changed.

## Local CI-parity verification

With the same loopback `APP_URL`, `AUTH_URL`, and `NEXTAUTH_URL` values as the
Phase 06.1.1 workflow:

| Gate | Result |
| --- | --- |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed |
| `pnpm test` | 53 files / 282 tests passed |
| `pnpm test:integration` | 9 files / 63 tests passed |
| `pnpm build` | Passed; 92 routes generated |

The initial remote run already passed the isolated PostgreSQL persistence,
production dependency audit, 10k benchmark, and production-mode E2E jobs
(22 Playwright tests). A follow-up push will re-run the quality job with the
correct test-origin fixtures.

## Security workflow status

The separate repository `Security` workflow's production dependency audit and
CodeQL jobs passed. Its Gitleaks job failed. No ignore rule, suppression, or
scanner configuration change has been made: the exact finding must be read
from authenticated GitHub Actions logs before a narrow, evidence-backed
remediation can be considered.
