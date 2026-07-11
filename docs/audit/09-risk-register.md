# Risk Register

| Risk | Probability | Impact | Severity | Mitigation | Rollback |
|---|---|---|---|---|---|
| UI parity regresses during React migration | Medium | High | High | Screenshot/Playwright visual checks and route-by-route migration | Keep static route active behind flag |
| Cart/wishlist loss during sync | High | Medium | High | Versioned client migration and guest merge tests | Retain local state read fallback |
| Inventory oversell during order migration | Medium | Critical | Critical | DB transaction, reservation lock, idempotency and concurrency tests | Disable new checkout; preserve existing stock ledger |
| Unauthorized order/payment access | High | Critical | Critical | Session auth, persisted RBAC, server policy tests | Deny production traffic until controls pass |
| Payment callback fraud | Medium | Critical | Critical | Signature, amount/reference verification and replay prevention | Disable provider, reconcile pending orders |
| Data migration corruption | Medium | Critical | Critical | Backup, dry-run, reconciliation and staging rehearsal | Restore backup; keep source read-only |
| SEO traffic loss | Medium | High | High | URL/metadata/sitemap parity and crawl validation | Re-enable static pages/redirect map |
| Performance degradation | Medium | High | High | Performance budgets, cache/ISR, load tests | Roll back release or feature flag |
| Secrets leak | Low | Critical | High | Vault, `.env.example`, secret scanning and rotation | Revoke/rotate affected secret |
| Provider/API availability | Medium | Medium | Medium | Adapter, queue, timeout/retry and manual fallback | Disable provider and queue requests |
