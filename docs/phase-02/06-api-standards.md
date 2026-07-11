# API Standards

All Route Handlers return `{ success, data|error, meta:{requestId} }`. Zod validates inputs; handlers delegate to authorization, service and repository layers. Public DTOs never expose Prisma records directly. Errors use stable codes and safe Persian client messages. Stack traces, database details, secrets and internal paths are never returned.

`GET /api/health` checks process health. `GET /api/ready` checks validated configuration and database readiness without exposing topology. Protected routes must use `requireActor` and `requirePermission` server-side.
