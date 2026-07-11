# Phase 03 — Database Changes

## Source of truth and status

The reviewed migration strategy is maintained in
[database-plan.md](database-plan.md). This companion document explains the
administrative data model and release constraints. Writing this documentation
does **not** execute a Prisma migration, connect to a database, seed data, or
change production data.

## Additive administrative model

| Entity | Intended responsibility |
| --- | --- |
| `AdminUser` | One-to-one administrative profile/state linked to an identity user |
| `Role` | Governed role code, name, description, system-role protection |
| `Permission` | Allow-listed `resource.action` code with grouping metadata |
| `UserRole` / `RolePermission` | Many-to-many membership and permission links |
| `SystemSetting` / version record | Typed category, versioned value, actor-linked history, sensitive flag |
| `MediaFile` | Metadata and storage reference only; no file bytes in PostgreSQL |
| `Notification` | Recipient-specific internal notification state with channel expansion path |
| `AuditLog` | Append-only administrative event metadata and viewer filter fields |

Existing identity/session/account structures must remain compatible with the
chosen Auth.js adapter design. The database must not become the only
authorization control: service-layer checks still protect critical roles and
scope.

## Integrity requirements

- Unique constraints protect identity, role codes, permission codes, storage
  keys, and applicable role/permission links.
- Foreign keys preserve referential integrity while choosing deletion behavior
  deliberately: retention/traceability for audit data takes priority over
  convenience.
- Indexes support the actual administrative query paths: status/date, role,
  permission group, recipient/status/date, media owner/date, and audit actor /
  action / entity / request ID.
- Settings versions are immutable history records; sensitive values must be
  redacted outside the privileged persistence boundary.
- Media deletion is soft at the record level and coordinated with the storage
  adapter only after authorization and audit handling.

## Migration safety contract

Before any schema modification reaches an environment:

1. Produce a migration report and inspect generated SQL on a disposable
   development database.
2. Confirm changes are additive or otherwise explicitly approved, including
   nullability, defaults, index creation, foreign keys, lock behavior, and data
   volume impact.
3. Test against staging with production-like scale and a verified backup.
4. Deploy application compatibility before or with the database change during an
   approved maintenance window.
5. Verify roles, permission links, session compatibility, indexes, and audit
   visibility after deployment.

Forbidden shortcuts include `prisma db push` against a shared/production
database, reset, drop, truncate, destructive backfill, and unreviewed reverse
migration. Roll back application code first; do not destroy data to recover.

## Open decisions

- Confirm the production Auth.js adapter and session persistence strategy.
- Define retention, legal hold, and anonymization policies for audit and media
  metadata.
- Define storage provider lifecycle, virus-scanning integration, and orphan-file
  reconciliation.
- Decide whether custom roles require tenant/business scoping in addition to
  branch scoping.
