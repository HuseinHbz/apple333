# Phase 05.1 — Security review

## Status and scope

**Status:** code and configuration-surface review only. This is not a penetration
test, a production configuration audit, a live-staging validation, or a security
certification.

**Review date:** 2026-07-20

No production system, secret, database, object store, Docker daemon, migration,
or deployment was accessed or changed for this report.

Evidence reviewed:

- `next.config.ts` and `deploy/nginx.production.conf` for application and
  internal-proxy headers;
- `src/server/storefront/route.ts`,
  `src/server/security/request-security.ts`, and storefront API routes for
  request handling, validation, mutation protection, caching, and rate limits;
- `src/server/admin/route.ts`, `src/modules/auth/session.ts`, and
  `src/server/security/permissions.ts` for admin authentication and RBAC;
- `src/server/storefront/guest-cart.ts` and the Phase 05 guest-wishlist storage
  boundary for browser-held state; and
- structured-data, metadata, response, logging, readiness, metrics, and media
  routes for output handling and operational exposure.

The production dependency scan is documented separately in
[11-dependency-review.md](11-dependency-review.md). Its actual result is **0
High, 0 Critical, and 2 Moderate** vulnerabilities; that is a dependency-scan
result, not an assertion that the application has zero security findings.

## Trust boundaries and observed controls

| Boundary | Observed control | Review conclusion |
| --- | --- | --- |
| Public browser → catalog/PIM API | `runStoreRoute` uses Zod route schemas, request IDs, safe request logging, and a local rate-limit guard. Catalog query limits pagination, filters, prices, and comparison slugs. | Good source-level control for the scoped public API; staging abuse testing is still required. |
| Public browser → cart / quote mutations | Mutation routes use `assertSameOriginForMutation`, Zod JSON schemas, private/no-store responses, and a per-route rate limit. | Source-level CSRF-style Origin control exists. It must be verified behind the actual staging TLS edge/proxy. |
| Browser cookie → guest cart | A 32-byte random token is `HttpOnly`, `SameSite=Lax`, `Secure` in production runtime mode, and SHA-256 hashed before persistence. | Sound scoped pattern; HTTPS and proxy behavior were not runtime-tested. |
| Browser local storage → wishlist | Payload is versioned, Zod-validated, slug-only, deduplicated, and bounded. | No account or payment data is stored. Local storage is never treated as authorization. |
| Admin browser → admin API | `withAdminRoute` requires active admin authentication, typed permissions, same-origin mutation checks, parsed input, no-store responses, and audit context. | Centralized source-level RBAC for reviewed routes; not an exhaustive route or live authorization test. |
| PIM data → metadata / JSON-LD | Canonical origin validation and typed public DTOs are used; JSON-LD escapes `<` before inline insertion. | Reduces script-breakout risk for catalog text; not a PIM moderation or XSS pentest guarantee. |

## Controls confirmed from source

### Input validation and error handling

- Storefront and admin wrappers parse body/query/path inputs with Zod. Catalog
  page size, pages, text filters, price bounds, product slugs, and comparison
  item counts are bounded.
- Unknown errors return a generic `INTERNAL_ERROR` message. Zod field failures
  are mapped to validation metadata rather than stack traces.
- Client request IDs are constrained to a narrow length/character pattern;
  invalid or absent values are replaced with a server-generated UUID.

### Authentication, authorization, and state

- The configured credentials provider is explicitly an admin provider. It
  requires active user/admin records and bcrypt verification.
- Database sessions have an eight-hour max age. Session and guest-cart cookies
  are `HttpOnly`, `SameSite=Lax`, and secure in production runtime mode.
- RBAC uses a typed permission allow-list; branch access has an explicit helper.
- Guest-cart tokens are random, format-checked, hashed before persistence, and
  not returned in API response bodies.

### Transport, browser, and proxy controls

- The reviewed Next.js and nginx configuration emit `X-Content-Type-Options:
  nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy:
  strict-origin-when-cross-origin`, and a restrictive camera/microphone/
  geolocation Permissions-Policy.
- The reviewed internal nginx configuration applies an API request limit and
  returns 404 for `/api/metrics`. The Compose topology keeps PostgreSQL, Redis,
  and MinIO off host-published ports.
- The in-process rate limiter describes itself as defence in depth: its bounded
  in-memory map is not a distributed rate-limit solution.

### Output, media, and logs

- Inline structured data serializes a typed public projection and replaces `<`
  with `\\u003c`. No unverified review/rating schema is emitted.
- PIM canonical URLs are accepted only if their origin matches `APP_URL`; other
  values fall back to a local product route.
- Public/admin media routes validate CUID parameters and sanitize filenames for
  `Content-Disposition`; public media also sets `nosniff`.
- The reviewed logger removes known sensitive context keys such as authorization,
  cookie, password, OTP, token, national code, and card number before logging.

## Open findings and required follow-up

| ID | Finding | Status | Required evidence or remediation |
| --- | --- | --- | --- |
| SEC-01 | No Content-Security-Policy was found in reviewed Next.js/internal nginx headers. HSTS was also not found there; it may be an external TLS-edge responsibility that was not inspected. | **High-priority gap — open** | Design CSP with documented nonce/hash and third-party policy. Validate report-only CSP and the HSTS edge decision on staging before enforcement. |
| SEC-02 | The in-process `Map` limiter is process-local. The nginx limiter helps only where that exact proxy is used; distributed behavior and trusted-proxy topology are not evidenced. | **High-priority gap — open** | Exercise abuse behavior on staging and select/enforce distributed or edge rate limiting when multi-instance topology requires it. |
| SEC-03 | `/api/ready` exposes configuration/database/Redis state and is covered by the reviewed general API proxy location. | **Medium — open** | Decide whether to return generic public liveness, edge-restrict readiness, or split public/private endpoints. Verify final edge behavior on staging. |
| SEC-04 | TLS, WAF/CDN, public DNS, secret-manager access, backup access, alert delivery, certificate lifecycle, and external proxy trust are outside this code review. | **High-priority evidence gap — open** | Complete an infrastructure security review against isolated staging and record observed evidence only. |
| SEC-05 | Customer auth and server-synced wishlist authorization are not Phase 05 features. | **Design gap — deferred** | Define lifecycle, authorization, CSRF, rate limits, audit events, deletion/export semantics, and tests before adding account data or synchronized writes. |
| SEC-06 | Two Moderate dependency advisories remain. | **Moderate — time-bounded exception** | Follow expiry, review, revocation, and remediation criteria in [11-dependency-review.md](11-dependency-review.md). |

## Limitations and non-findings

This review did **not** perform or prove:

- authenticated/unauthenticated penetration testing, SAST, DAST, secret
  scanning, license review, or malware scanning;
- live testing of cookies, same-origin enforcement, CSRF, rate limits, headers,
  TLS, HSTS, proxy trust, WAF, Redis, PostgreSQL, MinIO, or object storage;
- review of external Sentry, DNS, GitHub Environment, secret-manager, TLS-edge,
  backup, or monitoring configuration;
- exhaustive proof that every API route uses the reviewed wrappers; or
- absence of XSS, IDOR, authorization, or PIM-content vulnerabilities.

A scoped source search found no direct `uuid` import under `src/`, `scripts/`,
or `tests/`; the vulnerable package remains transitive through NextAuth and is
not considered absent.

## Required Phase 05.1 security evidence before approval

1. Re-run `pnpm audit --prod --json`; it must remain at **0 High and 0
   Critical**, with every Moderate remediated or covered by an unexpired,
   reviewed exception.
2. Run staging E2E coverage for public catalog, search, product detail,
   comparison, wishlist, cart, and mutation-origin failure cases.
3. Capture staging evidence for HTTPS/TLS, security headers, HSTS decision,
   cookie attributes, proxy trust, `/api/metrics` isolation, and readiness
   exposure.
4. Complete CSP design plus report-only validation before a production-acceptance
   claim.
5. Record rate-limit load/abuse behavior for the actual staging topology.
6. Perform independent security testing focused on admin RBAC, public DTO
   exposure, cart tokens, media access, input validation, and XSS paths.

## Conclusion

The reviewed source has meaningful foundations, but it lacks the runtime
evidence required for a Phase 05.1 production-security approval. The open
findings and temporary dependency exception mean Phase 05.1 remains **not
approved**.
