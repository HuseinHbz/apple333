# Phase 03 — User Management

## Scope

User management is an administrative capability for viewing operational user
profiles and governing account status and role assignment. It is not a
credential-recovery surface and must never reveal password hashes, one-time
passwords, session tokens, provider tokens, or secret verification material.

The following is a target functional contract; individual endpoints and screens
must be confirmed by implementation evidence before being presented as live.

## User list

The list is server-paginated and supports allow-listed search/filter fields:

| Field | Display/use rule |
| --- | --- |
| Identity | Name and a safe user identifier |
| Contact | Email and/or mobile only when the actor has `users.read` and business need |
| Status | Active, inactive, or suspended using a semantic status badge |
| Roles | Role names/codes, not an inferred privilege summary |
| Created date | Locale-formatted at presentation time |
| Activity | Only an approved, privacy-safe summary |

Search predicates must be constrained, parameterized by the repository layer,
and scoped before pagination. The client must not download the entire user set
to perform search or filtering.

## User detail

The detail view may present profile, contact details, role membership, effective
permissions, approved activity summaries, and creation metadata. It must show
the source of effective permissions (for example, roles) so staff do not mistake
an inherited permission for a direct grant.

Sensitive identity values, including national identifiers, require a separately
approved disclosure policy. A hash is not a display value.

## Governed actions

| Action | Minimum policy |
| --- | --- |
| Read/list | `users.read` and relevant branch/business scope |
| Create | `users.create`, validated input, duplicate-safe handling, audit event |
| Update profile/status | `users.update`, target scope check, audit before/after metadata that excludes secrets |
| Activate/deactivate | Explicit status transition policy; disallow self-lockout and protect critical operators |
| Assign/revoke role | Role-management permission, protected-role checks, target scope check, audit event |

Every mutation needs an actor, request ID, server-side permission check, Zod
validation, and a safe response DTO. UI visibility cannot authorize any of
these actions.

## Status-transition policy

Status changes should be explicit transitions, not arbitrary booleans:

```text
ACTIVE ──→ INACTIVE / SUSPENDED
INACTIVE ──→ ACTIVE
SUSPENDED ──→ ACTIVE only through an authorized recovery workflow
```

The service must reject transitions that would remove the last eligible
super-administrator or otherwise violate business continuity. Exact rules must
be implemented and tested before activation in production.

## Privacy and auditability

- Return minimal DTOs for each screen; do not serialize Prisma records directly.
- Do not put PII, credentials, raw tokens, or secret setting values into audit
  metadata.
- Record actor, action, entity type/ID, request ID, timestamp, and safe change
  summary for each administrative mutation.
- Keep audit viewing read-only and enforce its own `audit.read` authorization.

## Non-goals for this phase

Bulk import/export, identity verification, customer support impersonation,
password reset delivery, and customer self-service profile editing are separate
product workflows. They must not be silently added to the administrative API.
