# Legacy Local-v1 Cleanup

**Date:** 2026-07-11
**Branch:** `feature/phase-03-admin-platform`

## Decision

The repository now runs exclusively through the Next.js App Router application
under `src/`. The root-level static storefront, Python HTTP server, and raw
SQLite inventory schema are not imported, served, built, tested, or deployed
by the current pnpm/Docker runtime. They were removed from this branch.

The complete tracked local-v1 implementation remains recoverable through the
`legacy/local-v1` branch and the `v1.0-local` tag.

## Removed tracked artifacts

- Static storefront/dashboard: `index.html`, `catalog.html`, `product.html`,
  `compare.html`, `wishlist.html`, `checkout.html`, `platform.html`
- Static scripts/styles: `app.js`, `storefront.js`, `platform.js`, `styles.css`,
  `storefront.css`, `platform.css`
- Unsafe local runtime: `server.py`
- SQLite-only inventory draft: `db/phase-3-inventory.sql`
- Stale static SEO files: root `robots.txt` and `sitemap.xml`

`src/app/robots.ts` and `src/app/sitemap.ts` replace the old SEO files using
the current App Router metadata-route convention.

## Deliberately retained

- `data/applekhane.db*` and Python caches are ignored, untracked local files.
  They may contain user data, so they were not deleted.
- `docs/audit/**`, Phase 0/2/3/4 plans, and historical reports remain as
  migration evidence and product references; they are not runtime code.
- Docker, PM2, deployment scripts, Prisma, and all `src/**` files remain part
  of the current runtime.
