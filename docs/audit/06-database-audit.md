# Database Audit and Migration Report

## Current runtime database — verified

The ignored SQLite file contains: addresses, audit events, branches, warehouses, inventory balances, devices, transfers, reservations, stock movements, carts, orders, payments, invoices, shipments, coupons, gift cards and wallets. `server.py` creates those tables at application startup.

## Current model observations

- Inventory has useful quantity checks and unique IMEI/serial hashes; movement/audit concepts exist.
- Orders, items, payments, invoices, shipments and status history have direct SQLite foreign keys.
- The tracked PostgreSQL SQL file only describes Phase 3 inventory and has no runtime linkage to the SQLite order schema.

## Integrity and migration risks

- Application-startup DDL cannot provide reviewed migration history or safe rollback.
- `variant_id`, customer IDs and actor IDs are mostly free text without a product/user foreign-key model.
- IMEI/serial plaintext is retained beside hashes in SQLite.
- Soft deletion, row ownership, consistent audit fields, money/currency policy, tax rules and provider idempotency policy are incomplete.
- No Prisma schema, migration history, seed script or PostgreSQL backup/restore procedure exists.

## Missing/needed indexes and constraints

- PostgreSQL partial indexes for active carts/reservations and work queues.
- Unique active reservation per serialized device; unique order-payment provider reference per provider.
- Foreign keys from variants to catalog and from actors/customers to identity.
- Check/status enums, immutable ledger constraints, timestamps and `deleted_at` policy on applicable business entities.
- GIN/FTS strategy only after actual catalog/search requirements are defined.

## Non-destructive future migration plan

1. Create `docs/migration-reports/phase-00-prisma-baseline.md` before schema work.
2. Model Prisma entities against a reviewed canonical ERD; do not import SQLite DDL blindly.
3. Generate a baseline migration against an empty development PostgreSQL database only.
4. Add idempotent data-import scripts with dry-run, counts, reconciliation and rollback plan.
5. Rehearse restore and migration in staging before production. No reset, drop or `db push` is authorized.
