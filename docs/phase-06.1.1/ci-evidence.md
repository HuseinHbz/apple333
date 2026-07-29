# Phase 06.1.1 CI Evidence

`.github/workflows/phase06-inventory-evidence.yml` is the approval-evidence
workflow for `feature/phase-06.1.1-inventory-production-approval-closure`.
It has read-only repository permissions and uses only disposable GitHub
Actions PostgreSQL and Redis service containers. It never reads production
credentials, deploys, or targets a production database.

## Required evidence

For pull requests and pushes to the Phase 06.1.1 closure branch, the workflow
records artifacts for:

- locked dependency installation, Prisma validation/generation, type-check,
  lint, unit tests, integration tests, and a production build;
- guarded migration and isolated PostgreSQL persistence tests;
- deterministic seed, standalone production runtime, Playwright Chromium, and
  the Phase 06 inventory E2E suite;
- post-E2E `BranchInventory` reconciliation with `--fail-on-drift`;
- production dependency audit, which fails on any High or Critical finding;
- the guarded 10k benchmark **and an immediate sellable-stock reconciliation**.
  The 100k benchmark is intentionally reserved for an explicit manual
  dispatch or the scheduled run, and it is reconciled with the same command.

The E2E runner requires `INVENTORY_TEST_REDIS_URL` and `REDIS_URL` to be
`redis://127.0.0.1:56379`. The workflow maps its disposable Redis service to
that exact loopback port, so a different Redis target fails before browser
tests start.

## Artifacts and review

Every job retains logs under its `phase-06-*` artifact. In particular,
`phase-06-production-dependency-audit-*` contains the raw audit JSON and the
severity decision log. Moderate findings remain visible in those artifacts;
they are not suppressed, but do not satisfy the High/Critical failure gate.

The E2E artifact includes `inventory-reconciliation.json`; benchmark artifacts
include their matching reconciliation JSON. A successful reconciliation is
evidence only for each clean, disposable CI fixture state. It is not run after
database tests because those tests deliberately create drift fixtures to
validate detection behavior.

Phase 07 remains blocked until a reviewer verifies the required jobs and
their artifacts are green for the commit being approved.
