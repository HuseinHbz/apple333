# Technical Debt Register

## Critical

- `server.py` accepts identity/role from `X-User-ID` and `X-Role` and defaults to admin. This is an authorization bypass, not an authentication system.
- Payment confirmation is a mock endpoint that marks any pending payment successful. It must never be reachable in production.
- Checkout has hard-coded browser customer/item data and local browser cart state is not the checkout source of truth.
- SQLite runtime schema is created with `CREATE TABLE IF NOT EXISTS` in application startup, bypassing controlled migration review.

## High

- Static storefront catalog and server catalog are duplicated and can drift in price, product availability and variants.
- All API routing/business logic/repository access/error mapping are coupled in one 46KB file, `server.py`.
- No TypeScript, schema validation, tests, build script, lockfile, CI or dependency policy exists.
- Static `innerHTML` construction is widespread (`storefront.js`, `platform.js`, `checkout.html`), increasing XSS risk when data becomes external.

## Medium

- Duplicated header/footer and design markup across static pages.
- Styling and JavaScript are compressed into very long lines, impeding code review and blame.
- Product media is CSS illustration only; no optimized media pipeline or real image metadata.
- Static sitemap/canonical/product JSON-LD can become incorrect or duplicated.

## Low

- Dark mode, review UI, voice search and richer error/loading states are absent.

## Remediation complexity

| Area | Complexity |
|---|---|
| Bootstrap strict Next.js foundation | Medium |
| Component extraction / visual parity | Medium |
| PostgreSQL + Prisma baseline | High |
| Auth/RBAC and server contracts | High |
| Catalog/search/cart synchronization | High |
| Payment/shipping provider integration | High |
| Test/CI/observability/DevOps | High |
