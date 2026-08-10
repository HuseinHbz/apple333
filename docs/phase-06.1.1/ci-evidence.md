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

## Executed evidence

Exact-commit runs `30464638250`, `30464638805`, and `30464638078` passed for
`cdbb1500e28e4a472eca05e51c48693d287b2288`. Run `30464638805` retained
database, Quality, E2E, dependency-audit, and 10k benchmark artifacts.

Manual run `31379582084` refreshed the expensive 100k evidence. Its migration,
database, Quality, E2E, 100k benchmark, and reconciliation jobs passed. The
100k result was `passed=true`, with 400,000 canonical inventory rows, 400,000
sellable projections, and zero drift. The historical branch dependency job
failed on three High advisories published after its original approval run.
This is an explicit historical-lockfile finding, not a waived gate: current
integrated commit `fe412ea87a88010721368e0cbc66cf20c8c1fd11` passed dependency
audit, CodeQL, and Gitleaks with zero High/Critical findings.

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

Artifact review verified the retained functional reports and the current
integrated dependency-security evidence. Phase 06.1.1 is **APPROVED only as
integrated in `fe412ea`**; the old branch tip must not be deployed directly.
