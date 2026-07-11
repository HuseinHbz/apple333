# Phase 03 Database Change Plan

## Purpose

Phase 03 adds the administrative data required for user/role management, settings history, media metadata, notifications, and auditable actions. The existing identity models (`User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `SystemSetting`, and `AuditLog`) remain the source of truth and will be extended additively.

## Proposed additive changes

| Area | Change | Safety rationale |
| --- | --- | --- |
| Admin access | Add a one-to-one `AdminUser` profile to `User` | Separates administration state from customer identity without duplicating credentials. |
| Roles | Replace the fixed role enum with a validated string code and add `isSystem` | Enables governed custom roles while protecting critical built-in roles. |
| Permissions | Add a grouping field and indexes | Supports scalable discovery and filtering. |
| Settings | Add version records and actor links | Provides immutable history and supports audit requirements. |
| Media | Add metadata-only `MediaFile` records | Does not store file bytes in PostgreSQL; storage remains behind the existing abstraction. |
| Notifications | Add per-recipient `Notification` records | Supports internal notifications now and channel expansion later. |
| Audit logs | Add optional IP/user-agent fields and filter indexes | Supports the required read-only audit viewer without logging secrets. |
| Auth compatibility | Add the standard Auth.js-compatible user/account fields | Keeps the existing session/account models usable by a future/installed Auth.js adapter. |

## Constraints and invariants

- No table is dropped, renamed, reset, truncated, or backfilled destructively.
- No migration will be executed against a database in this phase without a reviewed, environment-specific migration report.
- Role deletion is rejected for `isSystem` roles in the service layer and recorded in the audit log.
- Sensitive configuration values are redacted from API DTOs and audit metadata.
- Media records use soft deletion; file removal is delegated to the storage adapter after authorization and audit validation.
- Audit events are append-only from application services. The viewer has no mutation endpoint.

## Migration procedure for a later reviewed deployment

1. Generate a Prisma migration in a disposable development database only.
2. Review generated SQL for additive DDL, nullable columns, safe defaults, indexes, and lock impact.
3. Take a verified production backup and test the migration on staging with production-like data volume.
4. Run the migration in a maintenance window with application compatibility already deployed.
5. Verify indexes, Auth.js/session compatibility, role seeds, and read-only audit access.
6. Roll back application code first if needed; do not use destructive reverse migrations on production data.

## Explicitly not executed in Phase 03

- `prisma migrate dev`
- `prisma migrate deploy`
- `prisma db push`
- `prisma db seed`
- database reset, drop, truncate, or production data mutation
