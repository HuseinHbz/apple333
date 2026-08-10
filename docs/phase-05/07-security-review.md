# Phase 05 — Storefront Security Review

## Review scope

This review covers Phase 05 storefront behavior that consumes the established
public PIM, cart, and route-protection foundations. It is a code-level review;
it is not a penetration test, production configuration review, or guarantee of
security certification.

No production environment, production database, secret, migration, payment,
order, inventory, installment, or trade-in operation was accessed or changed.

## Trust boundaries

| Boundary | Data/operation | Control used |
| --- | --- | --- |
| Public browser → PIM API | Published catalog/search/media data | Existing `/api/store/*` validation, public DTO projection, rate limits, and cache policy. |
| Server storefront → PIM service | Initial public page composition | Typed public projection only; no direct admin PIM model exposure. |
| Browser → cart API | Guest basket mutations | Existing same-origin checks, cookie/token boundaries, request validation, and private behavior. |
| Browser local storage → wishlist UI | Device-local product slugs | Versioned key, Zod slug validation, bounded collection, and hydration guard. |
| PIM fields → metadata/JSON-LD | SEO/PIM-provided text and URLs | Typed public DTO, canonical origin validation, and escaped JSON-LD script serialization. |

## Controls in place

### Public PIM and search

- Storefront search uses the canonical public PIM endpoint, not direct Prisma
  access from the browser.
- Query inputs flow through the existing catalog Zod schema and Phase 05
  normalization/schema boundary before API requests.
- The public API wrapper validates success envelopes before treating data as a
  product page.
- Existing route middleware/wrappers apply rate limiting to public PIM routes.
- Search synonym expansion is bounded; it cannot turn a single input into an
  unbounded request fan-out.

### Guest wishlist

- The wishlist contains only canonical product slugs, not account data,
  addresses, payment state, or PIM product snapshots.
- Local storage is untrusted. Read values are parsed/validated and the maximum
  item count is bounded before the state is used.
- The implementation is explicit that it is device-local; it does not claim
  cross-device persistence or authenticated sync.
- A future wishlist-sync interface exists as an architectural seam only; this
  phase creates no customer table, API, or database write.

### Cart and customer-sensitive interactions

- Phase 05 reuses the established guest cart implementation rather than
  reimplementing session/token handling.
- Cart mutations retain their existing same-origin request policy and validated
  API inputs.
- No checkout payment, order creation, finance, installment, inventory
  reservation, or trade-in workflow has been added under the storefront scope.

### SEO output

- Product canonical URLs supplied by PIM are accepted only if their origin
  equals the configured storefront origin; otherwise a safe local canonical is
  generated.
- JSON-LD output serializes typed public data and escapes `<` before insertion
  into an inline script, reducing script-breakout risk from catalog text.
- Review/rating structured data is omitted because no trusted review source is
  available; the storefront does not invent reputation data.

## Residual risks and required work

| Risk | Status | Next action |
| --- | --- | --- |
| CSP, nonce strategy, and third-party script policy | Not evaluated here | Perform an application/security-header review before production rollout. |
| Authentication/session model for customer account | Not implemented in Phase 05 | Design and review in the approved customer-auth phase. |
| Account-synced wishlist authorization | Deferred | Define ownership, CSRF, rate limits, audit trail, and deletion semantics before implementation. |
| Search abuse/automation at scale | Existing API safeguards only | Add observability and load testing; consider stronger controls based on evidence. |
| PIM data quality | Public DTO limits exposure but cannot ensure content accuracy | Establish publish validation and media/SEO moderation policy. |
| XSS/CSRF/authorization penetration testing | Not performed | Conduct independent testing against staging. |
| Production secrets/TLS/reverse proxy headers | Not inspected | Validate via deployment and infrastructure security review. |

## Security test evidence and limitations

Targeted automated tests should cover wishlist invalid-storage handling, search
request paths/envelopes, metadata canonical validation, JSON-LD escaping, and
the existing cart/PIM route validations. Quality-gate output must be used as
the source of truth for exact passing counts.

This review does not claim a completed threat model, external pentest,
production deployment review, or Phase 05 completion. It records the current
controls and the gaps that remain before production authorization.
