# Repository and Architecture Audit

## Directory structure — verified

```text
apple333/
├── index.html, catalog.html, product.html, compare.html, wishlist.html, checkout.html
├── storefront.js, storefront.css, app.js, platform.js, platform.css
├── platform.html
├── server.py
├── db/phase-3-inventory.sql
├── docs/phase-0, docs/phase-3, docs/phase-4, docs/phase-5
├── robots.txt, sitemap.xml
└── data/applekhane.db            # ignored local runtime database
```

Absent: `src/`, `app/`, `components/`, `package.json`, TypeScript config, Prisma folder, tests, Docker, scripts, GitHub Actions and deployment configuration.

## Runtime boundary

| Boundary | Current implementation | Evidence |
|---|---|---|
| Storefront | Static pages with shared browser script | `catalog.html`, `product.html`, `storefront.js` |
| Back office | Static HTML/JS dashboard | `platform.html`, `platform.js` |
| API | Python `ThreadingHTTPServer` and a single request handler | `server.py` |
| Data | SQLite generated at runtime | `server.py`, ignored `data/` |
| Future PostgreSQL | Inventory-only SQL reference, not used at runtime | `db/phase-3-inventory.sql` |

## Data flow

`storefront.js` contains a four-item client catalog and persists cart/wishlist/compare IDs in browser `localStorage`. `checkout.html` posts a hard-coded demo customer and item to `/api/v1/checkout`. `server.py` recalculates prices from a separate in-memory catalog, reserves a SQLite device, creates an order/payment/shipment/invoice and exposes a mock payment confirmation endpoint.

## Dependency map

- Browser: native DOM APIs and Google-hosted fonts.
- Server: Python standard library (`http.server`, `sqlite3`); no package lock or declared runtime version.
- No shared typed contract exists between frontend and backend.

## Reusable baseline

Visual tokens/layouts in `storefront.css`, product card rendering, compare table, accessibility skip link, stock balance transaction helper, order lifecycle transitions and audit-event concept are reusable as behavior/design references. They must be rewritten into typed components/services rather than imported directly into the target architecture.
