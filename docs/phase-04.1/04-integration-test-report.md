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

| Check | Result | Evidence |
| --- | --- | --- |
| Unit and mocked integration suite | Pass | `pnpm test` (85 tests) |
| Route integration suite | Pass | `pnpm test:integration` (22 tests) |
| Typecheck / lint / production build | Pass | `pnpm typecheck`, `pnpm lint`, `pnpm build` |
| E2E smoke suite | Pass | `pnpm test:e2e` (7 browser tests) |
| Real PostgreSQL persistence suite | Not run locally | Docker, PostgreSQL client tooling, and a disposable database are unavailable in this workstation session. |

No command in this phase has connected to a production, shared, or unknown
database. The missing local runtime result is a release blocker, not a passed
test.

## CI execution gate

The `pim-database` GitHub Actions job provisions an ephemeral PostgreSQL 16.6
service at `127.0.0.1:55432`, runs the guard, `migrate deploy`, post-migration
inspection, `migrate status`, and `test:pim-db`. Its result must be attached to
this report and the final completion report before Phase 04.1 is approved.
