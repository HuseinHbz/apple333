# Testing Strategy

- Unit: environment validation, errors/API envelope, permission guard and validator behavior.
- Integration: Route Handler responses, service/repository behavior against a test PostgreSQL database.
- E2E: homepage, login screen, health route and unauthorized admin access.
- CI: Prisma validation, typecheck, lint, unit/integration tests, build and Playwright smoke test.

Current verified execution: legacy Python/JavaScript syntax checks passed before Phase 02. New dependency-based checks are blocked until the slow registry install completes; no result is claimed in advance.
