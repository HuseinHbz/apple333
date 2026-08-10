# Phase 08 CI Evidence

## Workflow

`.github/workflows/phase08-payment-evidence.yml` defines the read-only-source,
non-deploying workflow **Phase 08 Payment Evidence**. Its named jobs are:

1. Quality;
2. Payment Migration;
3. Payment Database Tests;
4. Payment Concurrency;
5. Payment E2E;
6. Security;
7. Reconciliation;
8. 10k Benchmark;
9. 100k Benchmark;
10. Artifact Upload; and
11. Cleanup.

Each database job receives its own GitHub-hosted PostgreSQL service. E2E also
receives a job-scoped Redis service. The workflow has `contents: read`, does not
persist checkout credentials, contains no deployment job, and has no production
secret, database, gateway, or host access.

## Retained artifacts

The workflow uploads migration inspection, simulator/E2E logs, database and
concurrency reports, Playwright output, production dependency audit,
reconciliation JSON, 10k/100k benchmark JSON, and the Phase 08 documents. An
aggregate artifact downloads the available job artifacts and retains the full
bundle for 30 days.

The repository-wide Security workflow independently runs Gitleaks and CodeQL.
The Phase 08 Security job repeats Gitleaks and enforces zero High/Critical
production dependency findings.

## Current status

All mandatory local and GitHub-hosted evidence is green for evidence head
`9c9274efc0eb0da98ba497aca99862d15f3c0d5d`.

Draft PR: [#15](https://github.com/HuseinHbz/apple333/pull/15), targeting
`feature/phase-07-order-management` from
`feature/phase-08-payment-financial-orchestration`.

| Workflow | Event | Conclusion | Evidence |
| --- | --- | --- | --- |
| Phase 08 Payment Evidence | pull_request | success | [run 31393598128](https://github.com/HuseinHbz/apple333/actions/runs/31393598128) |
| Security | pull_request | success | [run 31393597974](https://github.com/HuseinHbz/apple333/actions/runs/31393597974) |
| Quality | pull_request | success | [run 31393597971](https://github.com/HuseinHbz/apple333/actions/runs/31393597971) |
| Phase 07 Order Management Evidence | pull_request | success | [run 31393598173](https://github.com/HuseinHbz/apple333/actions/runs/31393598173) |
| Phase 06.1.1 inventory production-approval evidence | pull_request | success | [run 31393597966](https://github.com/HuseinHbz/apple333/actions/runs/31393597966) |

The Phase 08 run passed Quality, Payment Migration, Payment Database Tests,
Payment Concurrency, Payment E2E, Security, Reconciliation, 10k Benchmark,
100k Benchmark, Artifact Upload, and Cleanup. The repository Security run
passed Dependency Review, production dependency audit, Gitleaks history scan,
and CodeQL. The Phase 07 and Phase 06.1.1 regression workflows also passed,
including their production-artifact browser evidence.

GitHub Dependency Graph and dependency alerts were enabled through the official
repository API after the first Dependency Review attempt reported that the
graph was disabled. The compare API then returned `200`, and the rerun plus the
final head run passed. No check was skipped, suppressed, or converted to a
non-blocking result.

GitHub separately reported 41 Dependabot alerts on the repository default
branch at push time (4 critical, 20 high, and 17 moderate). The Phase 08
lockfile and PR diff passed Dependency Review, and the tested production
dependency tree reported no known vulnerability. Default-branch alert
remediation remains a repository maintenance item and does not authorize
production payment activation.
