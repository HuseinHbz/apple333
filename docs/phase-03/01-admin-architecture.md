# Phase 03 — Admin Architecture

## Purpose and status boundary

This document is the architectural contract for the Apple333 administration
platform. It describes the target shape of Phase 03 and the rules that any
implementation must satisfy. It is not, by itself, evidence that a route,
screen, API endpoint, database migration, or automated test has been
implemented or passed.

The customer-facing legacy storefront remains outside the admin route tree and
must not be removed or rewritten as part of this phase.

## Route topology

The admin application is rooted at `/admin` and is designed as a protected App
Router subtree:

```text
/admin
├─ dashboard
├─ users
│  └─ [userId]
├─ roles
│  └─ [roleId]
├─ permissions
├─ settings
├─ media
├─ notifications
└─ audit-logs
```

An admin layout owns the shell (sidebar, header, breadcrumb, main content
container, loading state, and error boundary). Individual pages own only their
module content. Access checks must happen before data is disclosed, on the
server, rather than being inferred from visible navigation.

## Layering

```text
Admin page / client interaction
        ↓
Reusable admin UI components
        ↓
Typed API client / TanStack Query boundary
        ↓
Next.js Route Handler
        ↓
Authentication + permission guard + Zod validation
        ↓
Application service
        ↓
Repository
        ↓
Prisma / PostgreSQL
```

This separation prevents the UI from becoming an authorization boundary and
makes services independently testable. A route handler should not contain
business rules or raw Prisma queries; it should coordinate the guard,
validation, service call, response envelope, and audit context.

## Module boundaries

| Area | Responsibility | Must not own |
| --- | --- | --- |
| `src/app/admin` | Route composition, metadata, page-level loading/error UI | Authorization decisions or direct database access |
| `src/components/admin` | Presentational shell, tables, forms, feedback states | Fetching privileged data implicitly |
| `src/modules/*` | Feature DTOs, client hooks, feature components | Cross-feature persistence rules |
| `src/server/services` | Use cases, invariants, audit intent | HTTP serialization |
| `src/server/repositories` | Narrow persistence operations and projections | Permission decisions |
| `src/server/security` | Actor/session resolution, permission and scope evaluation | UI visibility as the only enforcement |

## Access lifecycle

1. Resolve a verified server-side session to an actor.
2. Reject missing, expired, inactive, or otherwise invalid actors.
3. Evaluate the required `resource.action` permission and, where applicable,
   branch scope.
4. Validate path, query, and body input with Zod.
5. Execute the service with a request ID and actor context.
6. Write an append-only audit event for auditable mutations.
7. Return only an allow-listed DTO in the standard API envelope.

The safe default is deny. Hiding an item in the sidebar is a usability feature,
not authorization.

## Dashboard data rules

Dashboard widgets may show real operational measurements when their data
source, time window, and access scope are explicit. Where a module is not yet
backed by trusted data, the widget must use an honest empty or unavailable
state—never fabricated revenue, order, product, or activity numbers.

## Performance and resilience requirements

- Fetch independently refreshable dashboard panels independently.
- Paginate every unbounded administrative list server-side.
- Select only fields required for the current DTO.
- Use stable cache/query keys that include actor-relevant scope.
- Treat database, cache, queue, and storage readiness as separate signals;
  do not expose topology or credentials in the UI.
- Provide deterministic loading, empty, error, and retry states for each data
  region.

## Completion evidence required

Implementation is ready for Phase 03 sign-off only when the protected shell,
server-side guards, route handlers, services, repositories, and relevant tests
are present and verified by the quality gates. The phase implementation report
and test report record that evidence; this architecture document does not
substitute for it.
