# Phase 03 — Admin API Contract

## Contract status

This is the API design contract for Phase 03. Endpoint names below are planned
surfaces unless implementation and test evidence says otherwise. Consumers must
not treat this document alone as proof that an endpoint is deployed.

All routes are rooted at `/api/admin` and require a verified actor except for
explicitly public endpoints documented elsewhere.

## Common request rules

1. Create or propagate a request ID.
2. Resolve the server-side actor and reject absent/invalid sessions.
3. Require the route permission and record/branch scope.
4. Validate params, query, and JSON body with Zod.
5. Call a service; repository access stays behind the service boundary.
6. Audit permitted administrative mutations.
7. Return an allow-listed DTO using the standard envelope.

## Response envelope

```ts
type ApiSuccess<T> = {
  success: true;
  data: T;
  meta: { requestId: string };
};

type ApiFailure = {
  success: false;
  error: { code: string; message: string };
  meta: { requestId: string };
};
```

Client messages must be safe for display. Stack traces, SQL/Prisma details,
filesystem paths, tokens, and sensitive configuration values are not API data.

## Resource contract

| Resource | Intended route family | Required permission (minimum) | Mutation audit |
| --- | --- | --- | --- |
| Users | `GET/POST /users`, `GET/PATCH /users/:id` | `users.read`, `users.create`, `users.update` | Yes |
| Roles | `GET/POST /roles`, `GET/PATCH/DELETE /roles/:id` | `roles.manage` | Yes |
| Permissions | `GET /permissions` | Role/governance read policy | No mutation in this phase unless explicitly added |
| Settings | `GET/PATCH /settings/:key` | `settings.read`, `settings.update` | Yes, with redaction |
| Media | `GET/POST /media`, `GET/DELETE /media/:id` | Media-specific policy | Yes |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read` | Recipient/scope policy | Yes for state changes |
| Audit logs | `GET /audit-logs` | `audit.read` | Viewer is read-only |
| Dashboard | `GET /dashboard` | Dashboard read policy | No, unless an action occurs |

Permission names for future resources must follow the `resource.action` grammar
and be registered in the server permission catalogue. Exact media, notification,
and dashboard permission names need explicit design before implementation.

## Pagination, filtering, and sorting

List routes accept an allow-listed pagination model, for example:

```text
?page=1&pageSize=25&query=...&status=ACTIVE&sort=createdAt.desc
```

The server caps `pageSize`, validates every filter/sort key, applies actor scope
before pagination, and returns a pagination DTO only when its fields are
accurate. Never accept raw SQL fields, arbitrary relation names, or unconstrained
filter objects from the client.

## Errors and HTTP semantics

| Situation | Typical status | Public behavior |
| --- | --- | --- |
| Invalid request | 400 | Field-safe validation response |
| No verified session | 401 | Authentication required; no protected data |
| Missing permission/scope | 403 (or policy-safe 404) | No policy internals or data leakage |
| Missing permitted record | 404 | Safe not-found response |
| Conflict | 409 | Safe conflict code, e.g. duplicate role code |
| Unexpected error | 500 | Generic message with request ID |

## Idempotency and concurrency

Write routes that can be retried by the browser/client should define an
idempotency or concurrency strategy before release. Settings updates and role
assignment are especially sensitive to lost updates; expected version checks or
transactional invariants should be applied in the service/repository layer.

## API testing evidence

Every route family requires integration coverage for success, missing session,
missing permission, invalid input, scope violation, and audit side effect where
applicable. This document makes no assertion that Phase 03 endpoint tests have
already been added or passed.
