# Phase 03 — Role and Permission Model

## Core principles

Apple333 uses role-based access control (RBAC) with permissions expressed as
`resource.action`. Roles collect permissions; users receive roles; the server
calculates effective permissions for each request. Authorization is always
server-side, default-deny, and scoped before data is accessed.

The model is designed to support branch-aware operation. A permission grant is
not sufficient when the target record lies outside the actor's permitted branch
or business scope.

## Default role catalogue

| Role code | Intended responsibility |
| --- | --- |
| `SUPER_ADMIN` | Platform-wide emergency and governance administration |
| `ADMIN` | General administration within defined policy |
| `BUSINESS_OWNER` | Business visibility and governed management authority |
| `BRANCH_MANAGER` | Management within assigned branch scope |
| `SALES_STAFF` | Sales workflows permitted for assigned scope |
| `WAREHOUSE_STAFF` | Inventory and warehouse workflows permitted for assigned scope |
| `FINANCE_STAFF` | Finance workflows permitted for assigned scope |
| `SUPPORT_STAFF` | Support workflows permitted for assigned scope |
| `CUSTOMER` | Non-admin customer access; never implicitly grants admin access |

Critical platform roles must be marked as system roles. A service must reject
deletion or unsafe mutation of a protected role, and audit every attempted or
successful governance action according to policy.

## Permission grammar

```text
resource.action
```

Examples: `users.read`, `users.create`, `users.update`, `users.delete`,
`roles.manage`, `settings.read`, `settings.update`, and `audit.read`.

The permission catalogue is an allow-list owned by the server. Do not accept an
arbitrary permission string from the client as authorization evidence. New
permissions require documentation, server enforcement, navigation policy, and
tests.

## Evaluation algorithm

```text
authenticated actor
  → active account/session check
  → collect active roles
  → collect effective permissions
  → require requested resource.action
  → enforce branch/record scope
  → execute use case
```

Failure at any step produces a safe authentication or authorization failure.
The response must not tell an unauthorised actor whether a protected resource
exists unless the product has a documented reason to do so.

## Role management governance

- Create/update requests require validated names, codes, descriptions, and an
  allow-listed permission set.
- An actor may only delegate permissions already present in that actor's
  effective permission set; the same rule applies when assigning a role to a
  user. This prevents a role editor from creating a path to self-escalation.
- System role codes are reserved and can only enter the database via the
  controlled bootstrap/seed path, never via the custom-role endpoint.
- A mutation must prevent duplicate role codes and invalid permission links.
- Critical role deletion and self-escalation paths are rejected server-side.
- Assignment/revocation validates both the target user and actor scope.
- The audit event identifies actor, target, role, request ID, and safe diff;
  it excludes session/token data.

## UI policy

Navigation and action controls may be filtered by effective permission to avoid
dead ends, but that filtering is only a convenience. API routes and services
must repeat authorization. A disabled action should provide a neutral policy
explanation without revealing confidential privilege assignments.

## Testing contract

The permission checker, role mutation rules, scope checks, unauthorized API
responses, and protected-role behavior require unit/integration coverage. E2E
coverage must establish that an unauthenticated user cannot reach admin data
and that an authorized role cannot exceed its assigned scope. This document does
not claim those tests currently exist or pass.
