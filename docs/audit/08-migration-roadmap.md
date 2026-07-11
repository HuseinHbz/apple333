# Incremental Migration Roadmap

## Classification

| Asset | Classification | Rationale |
|---|---|---|
| Storefront visual language and responsive layouts | Refactor | Preserve approved look while extracting components |
| Static product-card/compare interaction behavior | Refactor | Reimplement with typed state and trusted data |
| Inventory/order lifecycle rules | Reuse directly as business reference | Revalidate through tests and service-layer design |
| `server.py` HTTP implementation | Replace | Unsafe/untyped local server; retain only as local-v1 reference |
| SQLite runtime schema | Replace | Use reviewed PostgreSQL/Prisma baseline |
| Static storefront pages | Remove after replacement | Keep untouched until App Router parity is accepted |
| Mock payment/provider data | Remove after replacement | Do not carry into production |
| Dark mode, reviews, voice search, AI | Postpone | Not foundation blockers |

## Safe sequence

1. Capture visual and flow baseline from current pages; no deletion.
2. Add Node LTS project tooling, strict TypeScript, test runners and CI skeleton; no production route cutover.
3. Introduce `src/app/(store)`, shared design-system components and a single migrated read-only catalog route behind a feature flag.
4. Create Prisma baseline report/schema, review it, then generate additive migrations only in development/staging.
5. Implement identity/RBAC and typed server service/repository/validator layers.
6. Migrate catalog/search/cart/wishlist, including guest-to-user merge and server price/inventory validation.
7. Migrate order/payment/shipping using provider adapters and audited callbacks; never reuse mock confirmation.
8. Add observability, deployment topology, performance/security testing and controlled rollout/rollback.

## Compatibility rules

Do not change current URLs or remove static files until corresponding Next routes pass visual, accessibility and E2E parity checks. Feature flags and database import dry-runs are mandatory at each cutover.
