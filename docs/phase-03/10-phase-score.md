# Phase 03 — Quality Score Rubric

## Scoring policy

Phase 03 has a target minimum score of **9.8 / 10**. The score is evidence
based; planned design, screenshots, or documentation alone cannot raise a
category score. A category with a material security, test, or production
blocker is not eligible for sign-off even if its arithmetic average appears
high.

## Categories

| Category | Evidence required for a 10 | Minimum acceptable evidence |
| --- | --- | --- |
| Architecture | Clear App Router/module/service/repository boundaries; no direct UI-to-DB access; documented data flow | Boundaries implemented and reviewed |
| UI | Consistent reusable system, accessible states, responsive/RTL review | All required admin states render coherently |
| UX | Honest data/empty states, safe destructive flows, keyboard/focus behavior | Primary workflows are comprehensible and safe |
| Security | Verified auth, server-side RBAC/scope, validation, redaction, audit, abuse-control plan | No known privilege-escalation or IDOR gap in delivered paths |
| Performance | Paginated/scoped queries, minimal DTOs, resilient loading | No unbounded administrative fetch on core paths |
| Maintainability | Strict TypeScript, typed contracts, small components/services, tests around invariants | No critical duplication or hidden authorization logic |
| Documentation | Architecture, API, database safety, tests, limitations, implementation facts current | Documents match final branch behavior |

## Mandatory gates

The phase is automatically **not approved** if any of the following is missing
or failing:

- Typecheck, lint, production build, unit, integration, and configured E2E
  smoke test results for the final branch.
- Prisma schema validation/client generation, where the schema is part of the
  branch.
- Verified protection of admin routes and server-side permission enforcement.
- Verified user/role governance, audit append-only behavior, and sensitive-data
  redaction for delivered features.
- Migration safety evidence for any executed schema change.
- A no-regression check for the preserved storefront.

## Scorecard (pending evidence)

| Category | Score | Evidence status |
| --- | ---: | --- |
| Architecture | — | Pending final review |
| UI | — | Pending final review |
| UX | — | Pending final review |
| Security | — | Pending final review |
| Performance | — | Pending final review |
| Maintainability | — | Pending final review |
| Documentation | — | Pending final review |
| **Overall** | **— / 10** | Not assessed; Phase 03 is not approved by this document |

## Review method

1. Compare the final diff to the Phase 03 architecture and database plan.
2. Read the services/handlers for authorization before data access and audit
   after successful governed actions.
3. Execute all quality gates on the final branch and record exact outputs.
4. Review UI at desktop and narrow widths, including RTL, empty, loading, error,
   and unauthorized states.
5. Reconcile every claimed endpoint, schema change, and test with the source.
6. Record residual risks and obtain explicit owner approval for any deferred
   production control.

The reviewer assigns the final number only after these steps. If the score is
below 9.8 or a mandatory gate is incomplete, reject the phase for redesign or
completion work rather than rounding upward.
