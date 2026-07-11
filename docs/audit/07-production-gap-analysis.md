# Production Gap Analysis

| Target capability | Current state | Gap / dependency | Recommended phase |
|---|---|---|---|
| Next.js App Router + strict TS | Static HTML/JS; Python server | Bootstrap Node project and shared contracts | 1 |
| React component system | Duplicated static markup | Extract approved UI without visual changes | 2 |
| PostgreSQL + Prisma | Local SQLite; standalone inventory SQL | ERD, Prisma baseline and migration report | 3 |
| Zod Route Handlers | Manual Python parsing | Typed API/service/repository boundaries | 4 |
| Auth/RBAC | Caller headers select admin/role | Session provider, persisted permissions, branch policy | 4 |
| Catalog/search | Four static products + browser filtering | Product module, search index/FTS, Persian normalization | 5 |
| Cart/wishlist | Browser `localStorage` | Guest cart, account merge, server sync, Redis/cache | 5 |
| Order/payment/shipping | Local mock workflow | Provider adapters, signed callbacks, queues, invoice service | 6 |
| SEO/performance | Static metadata and sitemap | Dynamic metadata, SSR/ISR, image CDN, cache | 7 |
| Testing/CI | No test infrastructure | Vitest, RTL, Playwright, GitHub Actions | 1 then continuous |
| DevOps/monitoring | No tracked config | Docker, Nginx, PM2, backups, Sentry, Prometheus/Grafana | 8 |

The current UI is a valuable visual reference, but none of the enterprise runtime requirements can be inferred as complete from the existing implementation.
