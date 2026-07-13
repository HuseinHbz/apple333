# Phase 04.1 — integration and persistence test report

## Test topology

Database-backed PIM tests are deliberately separate from the default Vitest
suite. They run only through `pnpm test:pim-db` after the guarded
`pnpm pim:test:migrate` command has proven a pristine `apple333_pim_test`
target and applied the reviewed migration.

The real test covers:

- active brand and warranty creation/readback;
- root/child category persistence and category-cycle rejection;
- product, variant, SKU, SEO, specification, and media association;
- document-media rejection for an image gallery role;
- `DRAFT -> REVIEW -> PUBLISHED` workflow history;
- public `/api/products`, `/api/products/[slug]`, and `/api/categories` route
  reads from PostgreSQL, published-only visibility, and safe SEO projection;
- import creation, invalid-row logging, exactly-once apply rejection, and a
  rollback assertion after a post-preview SKU conflict.

## Local evidence

| Check                               | Result          | Evidence                                                                                                  |
| ----------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| Unit and mocked integration suite   | Pass            | `pnpm test` (92 tests)                                                                                    |
| Route integration suite             | Pass            | `pnpm test:integration` (22 tests)                                                                        |
| Typecheck / lint / production build | Pass            | `pnpm typecheck`, `pnpm lint`, `pnpm build`                                                               |
| E2E smoke suite                     | Pass            | `pnpm test:e2e` (7 browser tests)                                                                         |
| Real PostgreSQL persistence suite   | Not run locally | Docker, PostgreSQL client tooling, and a disposable database are unavailable in this workstation session. |

No command in this phase has connected to a production, shared, or unknown
database. Local PostgreSQL remains intentionally unclaimed; the authoritative
database evidence is the disposable CI run below.

## Final isolated CI evidence

Final source commit: `b82bef573928393ab79354102b6d196cdd33c280`.

The [Quality run 29238326940](https://github.com/HuseinHbz/apple333/actions/runs/29238326940)
completed successfully. Its **Verify isolated PIM database activation** job
(`86778151237`) provisioned an ephemeral PostgreSQL 16.6 service at
`127.0.0.1:55432` and demonstrated all of the following:

- the strict guard accepted only `apple333_pim_test` / `apple333_pim_test` and
  found zero public-schema tables before migration;
- `20260713000000_phase_04_1_pim_activation` applied successfully;
- post-migration inspection found 39 tables and `prisma migrate status`
  reported the schema up to date; and
- `tests/database/pim-persistence.test.ts` passed all 5 tests in 770ms.

The same Quality run passed strict typecheck, ESLint, 92 default tests, 22
route-integration tests, deployment-asset validation, production build, and 7
Playwright smoke tests. This evidence proves only the disposable CI target; it
does not authorize a production or legacy-database migration.
