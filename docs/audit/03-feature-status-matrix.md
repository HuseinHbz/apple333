# Feature Status Matrix

| Feature | Status | Location | Production readiness | Risk | Recommended action |
|---|---|---|---|---|---|
| Homepage | Partially implemented | `index.html`, `styles.css` | No | Medium | Rebuild as App Router server page; preserve approved layout |
| Catalog | Local-only | `catalog.html`, `storefront.js` | No | High | Replace static catalog with server data and faceted search |
| Product detail | Mock-only | `product.html`, `storefront.js` | No | High | Dynamic route, real variants, media, inventory and metadata |
| Search | Client-side filter only | `storefront.js` | No | High | PostgreSQL/search provider with Persian normalization and analytics |
| Filters | Partially implemented | `catalog.html` | No | Medium | Implement query params, validated filters and counts |
| Compare | Local-only, up to four IDs | `storefront.js`, `compare.html` | No | Medium | Server product specs and shareable comparison URLs |
| Wishlist | Local-only | `storefront.js`, `wishlist.html` | No | High | Guest persistence + authenticated synchronization and notifications |
| Cart | Local-only preview | `storefront.js`; checkout bypasses it | No | Critical | Server cart, merge policy, inventory and price revalidation |
| Checkout/order | Local MVP | `checkout.html`, `server.py` | No | Critical | Typed API, real auth/payment/shipping and idempotency |
| Inventory/IMEI | Local MVP | `server.py`, `db/phase-3-inventory.sql` | No | Critical | PostgreSQL/Prisma migration and authorization enforcement |
| Responsive layout | Partially implemented | `storefront.css`, `styles.css` | Not verified | Medium | Device matrix + visual regression tests |
| SEO | Partial static baseline | `robots.txt`, `sitemap.xml`, product JSON-LD | No | High | Next metadata, dynamic sitemap/canonical/OpenGraph |
| Dark mode | Missing | — | No | Low | Postpone until design-system migration |
| Reviews | Missing | — | No | Medium | Postpone after catalog/customer foundation |
| Notifications | Missing in storefront | — | No | Medium | Event/outbox provider architecture after auth |

Status definitions: **local-only** requires the local browser/runtime; **mock-only** uses seeded or static data; **partially implemented** has a UI or isolated behavior but lacks trusted end-to-end support.
