# Phase 04 - Testing Report

## Status

**Implementation evidence plus remaining test strategy.** Phase 04 now has
unit tests for PIM validators and CSV staging, integration tests for protected
PIM routes and public aliases, and a protected-page Playwright regression.
The database-backed part of this strategy remains blocked by the intentional
absence of an approved additive migration.

## Executed evidence

| Command | Result | Scope |
| --- | --- | --- |
| `tsc --noEmit` | Pass | Strict PIM application typecheck |
| `eslint .` | Pass | Application and test linting |
| `prisma validate` with inert validation URL | Pass | Schema syntax and relation validation only |
| `next build` | Pass | Production build of Phase 04 pages/routes |
| Focused Vitest PIM suites | Pass, 18 assertions | Validators, CSV parser, RBAC/validation routes, public aliases |
| Full Vitest suite | Pass, 50 tests | Phase 03 regression plus Phase 04 route/unit coverage |

The focused Vitest result is not a substitute for a migration-backed PostgreSQL
integration suite. It verifies route boundaries by mocking the service layer.

The Phase 03 quality report remains the evidence for the existing storefront.
Phase 04 must add its own evidence without weakening strict TypeScript,
linting, existing unit/integration/E2E tests, or storefront contract coverage.

No database migration has been applied to generate Phase 04 integration-test
tables. Therefore migration-dependent PIM tests cannot yet be reported as
passing.

## Required quality gates

| Gate | Required result | Phase 04 initial status |
| --- | --- | --- |
| Prisma validation and client generation | Pass against reviewed schema | Pending final schema/migration review. |
| TypeScript strict typecheck | Pass | Pending PIM implementation. |
| Lint | Pass with no suppressed PIM errors | Pending PIM implementation. |
| Production build | Pass | Pending PIM implementation. |
| Unit tests | Pass | Planned. |
| Integration tests | Pass against isolated PostgreSQL | Blocked until reviewed additive migration exists. |
| Playwright E2E smoke/regression | Pass | Planned after protected UI/routes exist. |
| Existing storefront regressions | Pass | Required; no Phase 04 evidence yet. |

## Unit-test plan

| Area | Representative cases |
| --- | --- |
| Validators | Strict input rejection, slug normalization, decimal-safe price/cost validation, SKU/barcode rules, category/attribute compatibility, canonical path policy. |
| Product service | Draft creation, state transitions, approver separation, archive semantics, public projection omission rules. |
| Variant/SKU service | Duplicate option combination, duplicate SKU, optional barcode uniqueness, sellable-state checks. |
| Category/brand service | Parent cycle prevention, soft delete/deactivation rules, normalized uniqueness. |
| Specification service | Category-scoped attributes, value type validation, public/search projection building. |
| SEO builder | Metadata fallback, canonical validation, JSON-LD allow-list, no fake offers/reviews. |
| Import parser | CSV/XLSX mapping, row limits, malformed input, formula-injection escaping, preview revision/idempotency. |
| Mapping/redaction | No price cost/internal status/import data in public DTOs. |

## Integration-test plan

Integration tests require an isolated disposable PostgreSQL database created
from a reviewed migration. They must never target a developer's shared or
production database.

| Scenario | Required assertions |
| --- | --- |
| Product CRUD | Permissions, Zod failures, conflict mapping, audit event, soft delete/archival. |
| Publication | Only valid review product publishes; stale version and unauthorized publish fail. |
| Category/brand/warranty/attributes | Relationship constraints and safe deletion failure paths. |
| Public product API | Only published/non-deleted data, safe fields only, cache headers, stable Phase 03 compatibility. |
| Media association | Authorized attachment, deleted/unapproved media rejection, public media gate. |
| Import preview/apply | No direct live write, row diagnostics, idempotency, atomic batch behaviour or explicit partial failure. |
| Import rollback | Journal-based compensation only; conflict blocks unsafe rollback. |
| Migration compatibility | Existing Phase 03 product/cart/inventory rows remain readable and storefront contracts pass after backfill fixture. |

## E2E test plan

Use Playwright with a seeded, isolated test environment and a real admin login.
The smoke suite should cover:

1. unauthorized visitor cannot access PIM pages or mutation routes;
2. authorized catalog manager creates a draft product with a variant and SKU;
3. editor attaches existing approved media and valid specifications;
4. reviewer submits/publishes the product only with `products.publish`;
5. public product detail shows only the published projection;
6. an archive removes public discovery without corrupting the admin record;
7. import preview displays a bad-row diagnostic and cannot apply it;
8. an approved import applies once even when the browser repeats a request.

## Test data policy

- Test fixtures use synthetic catalog values and no personal customer data.
- Test data is created through migration/seed utilities dedicated to the
  disposable test database.
- Do not point E2E or integration tests at a production database.
- Store test credentials in CI secrets, never source files or reports.
- Import fixture files are bounded, non-malicious samples plus explicit adversarial
  files for parser security cases.

## Performance and scale verification

The target is administrative handling of 100,000+ products. Before sign-off,
measure and document:

- server-paginated product/category/brand lists at representative cardinality;
- product detail select size and query count;
- index use for slug, SKU, barcode, status, category, brand, and import batch
  filters;
- import validation/apply throughput with memory and batch limits;
- sitemap/product metadata generation behaviour under cache invalidation.

Performance claims require reproducible environment, dataset size, command,
metrics, and date; they cannot be inferred from local development success.

## Reporting template for execution

When implementation starts, update this report with one row per command:

| Command | Environment | Result | Failures / remediation | Evidence link |
| --- | --- | --- | --- | --- |
| `pnpm prisma:validate` | local/CI | Pending | - | - |
| `pnpm typecheck` | local/CI | Pending | - | - |
| `pnpm lint` | local/CI | Pending | - | - |
| `pnpm build` | local/CI | Pending | - | - |
| unit suite | local/CI | Pending | - | - |
| integration suite | isolated PostgreSQL | Pending | - | - |
| Playwright PIM suite | seeded test environment | Pending | - | - |
