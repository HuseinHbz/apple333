# Phase 03 Storefront — Production Readiness Gaps

Phase 03 is code-complete, but production launch requires the following
controlled follow-up work:

1. Review generated additive migration SQL in a disposable PostgreSQL
   environment, then apply it through the approved deployment process.
2. Import approved catalog, media, price, branch, and inventory data. No demo
   products or invented prices were added.
3. Build governed admin CRUD and publishing workflows for catalog and branch
   inventory, with audit events and RBAC permissions.
4. Replace the in-memory development rate limiter with a shared rate-limit
   service before multi-instance deployment.
5. Configure production object storage/CDN for public product media; the
   development local-media adapter is not a production storage backend.
6. Complete Phase 04 before enabling order placement, payment, stock
   reservation, delivery-cost calculation, coupons, gift cards, wallets,
   insurance, or installments.
7. Add fixture-backed PostgreSQL integration and concurrency tests after a
   reviewed migration is available.
