# Phase 03 — Admin API Documentation

All endpoints use the `{ success, data | error, meta: { requestId } }` envelope, validate input with Zod, resolve the actor server-side, require a permission, and set `Cache-Control: private, no-store`.

| Endpoint | Methods | Permission | Notes |
| --- | --- | --- | --- |
| `/api/admin/dashboard` | GET | `dashboard.read` | Real identity/system counts; future business metrics are explicitly unavailable. |
| `/api/admin/users` | GET | `users.read` | Paginated, search/status-filtered safe DTOs. |
| `/api/admin/users/:id` | GET, PATCH | `users.read`, `users.update` | Detail/status update; self-lockout rejected. |
| `/api/admin/users/:id/roles` | PATCH | `users.update` | Validated role assignment with audit event; cannot delegate permissions the actor lacks. |
| `/api/admin/roles` | GET, POST | `roles.read`, `roles.create` | List/create custom roles; reserved system codes and out-of-scope permission delegation are rejected. |
| `/api/admin/roles/:id` | GET, PATCH, DELETE | `roles.read`, `roles.update`, `roles.delete` | System roles cannot be changed or deleted. |
| `/api/admin/roles/:id/permissions` | PATCH | `roles.update` | Replaces validated permission links atomically without allowing privilege delegation. |
| `/api/admin/permissions` | GET | `permissions.read` | Grouped `resource.action` catalogue. |
| `/api/admin/settings` | GET, PATCH | `settings.read`, `settings.update` | Versioned values; sensitive values are redacted. |
| `/api/admin/settings/:key/versions` | GET | `settings.read` | Redacted immutable settings history. |
| `/api/admin/media` | GET, POST | `media.read`, `media.create` | Metadata list/create endpoint. |
| `/api/admin/media/upload` | POST | `media.create` | FormData upload with MIME, extension, size, and magic-byte checks. |
| `/api/admin/media/content` | GET | `media.read` | Authorized local-development content read; access is audited. |
| `/api/admin/media/:id` | DELETE | `media.delete` | Soft deletion with audit event. |
| `/api/admin/notifications` | GET, POST | `notifications.read`, `notifications.update` | Internal notification foundation. |
| `/api/admin/notifications/:id` | PATCH | `notifications.update` | Marks notification read with audit event. |
| `/api/admin/audit-logs` | GET | `audit.read` | Read-only pagination and actor/action/resource/date filters. |

Cookie-authenticated mutations additionally require same-origin validation and an in-memory rate-limit preparation. Each successful mutation is transactionally paired with an append-only audit record. APIs do not serialize Prisma records, password hashes, OTPs, session/provider tokens, national-code hashes, or sensitive setting values.
