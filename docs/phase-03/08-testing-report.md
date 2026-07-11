# Phase 03 — Testing Report and Acceptance Matrix

## Reporting boundary

This file records the test requirements and evidence standard for Phase 03. It
does not mark a Phase 03 test as passed unless a command result is recorded
against the final branch state. Phase 02.1 results cannot be reused as evidence
for newly added admin behavior.

## Required quality gates

| Gate | Command / method | Required evidence |
| --- | --- | --- |
| TypeScript | `pnpm typecheck` | Strict type check passes |
| Lint | `pnpm lint` | No suppressed/disabled rule used to obtain a pass |
| Build | `pnpm build` | Production build completes |
| Unit | `pnpm test` or targeted Vitest command | Permission, role service, user service, and validators |
| Integration | `pnpm test:integration` plus admin route suites | Authentication, authorization, validation, service/repository behavior |
| E2E | `pnpm test:e2e` | Protected admin access and key governed flows |
| Prisma | `pnpm prisma:validate` and `pnpm prisma:generate` | Schema/client validation only; no migration required |

## Required test scenarios

### Unit

- Permission allow/deny behavior and unknown permission handling.
- Branch/record-scope policy where the actor model supports it.
- Protected system-role and self-lockout invariants.
- User status transitions and role-assignment validation.
- Zod validation for pagination, filters, IDs, payloads, and media metadata.
- Redaction behavior for sensitive setting values and audit metadata.

### Integration

- Unauthenticated admin route access is rejected without protected data.
- Authenticated but unauthorized actors receive a safe denial.
- Authorized list/detail requests obey scope and use paginated DTOs.
- Invalid body/query/path input is rejected before service execution.
- Role/settings/media/user mutations create an appropriate audit event.
- Audit logs cannot be mutated through the viewer API.

### E2E smoke

- An unauthenticated visit to `/admin` is blocked or redirected.
- An authorized actor reaches the dashboard shell.
- A user-management flow preserves validation and shows result/error states.
- A role assignment cannot exceed the actor's authority.
- No existing storefront smoke path regresses.

## Known environment considerations

- Playwright requires a compatible local Chromium binary. Browser installation
  is an environment prerequisite, not a replacement for executing the E2E
  suite.
- Integration tests that use Prisma need an isolated PostgreSQL test database
  and deterministic fixtures; never point them at production.
- Tests must not depend on a caller-controlled identity header, mock business
  metrics, real external SMS/email services, or production storage.
- The historic Phase 02.1 report contains its own command evidence. Its E2E
  status may change only when the command is rerun and recorded; consult that
  report and CI rather than assuming a local browser is available.

## Result table (to be completed from final execution)

| Gate | Status | Evidence / command output |
| --- | --- | --- |
| Typecheck | Not assessed for Phase 03 | Pending final branch execution |
| Lint | Not assessed for Phase 03 | Pending final branch execution |
| Build | Not assessed for Phase 03 | Pending final branch execution |
| Unit | Not assessed for Phase 03 | Pending final branch execution |
| Integration | Not assessed for Phase 03 | Pending final branch execution |
| E2E | Not assessed for Phase 03 | Pending final branch execution |
| Prisma validation/generation | Not assessed for Phase 03 | Pending final branch execution |

Any failure must remain visible in a quality-gate report with command, result,
error summary, root cause, and recommended/implemented fix. Tests must not be
skipped or weakened to improve the score.
