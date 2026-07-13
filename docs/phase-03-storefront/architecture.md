# Phase 03 Storefront Architecture

```text
App Router store pages
        ↓
Storefront components + local cart store
        ↓
Public catalog / quote route handlers
        ↓
Zod validation + allow-listed DTOs
        ↓
Catalog and inventory services/repositories
        ↓
Prisma / PostgreSQL
```

The public catalog is read-only. The browser may keep a local cart for a guest
experience, but the checkout quote always re-reads product, variant, price, and
branch availability on the server. This deliberately prevents client-side
price authority while deferring order/payment creation to Phase 4.
