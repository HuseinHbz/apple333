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

All mandatory local evidence is green. GitHub Actions evidence is pending the first push of
this branch. Phase 08 must remain **NOT APPROVED** until all mandatory Phase 08
jobs and the repository security checks complete successfully. Run URLs and
conclusions will be recorded here without rewriting or fabricating evidence.
