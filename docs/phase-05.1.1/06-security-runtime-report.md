# Phase 05.1.1 - Module 07: Security runtime validation

**Review date:** 2026-07-20
**Scope:** Apple333 storefront and supporting application/deployment source only
**Review mode:** static code/configuration review plus focused local tests
**Runtime target accessed:** none
**Production, staging, database, Docker, secret manager, CDN/WAF, DNS, TLS edge, and external network access:** none

## Decision

**Not approved for production.** This report found no confirmed High or Critical exploitable vulnerability from the reviewed source, but it also cannot prove that none exists. High-priority control and runtime-evidence gaps remain, including no implemented Content-Security-Policy (CSP), no observed TLS/HSTS headers, and no demonstrated distributed rate-limit behaviour. Consequently, the Module 07 acceptance condition (runtime validation with no High/Critical finding) is **not evidenced**.

This is deliberately not a penetration test, DAST scan, SAST scan, secret scan, certificate audit, or production-security certification.

## Evidence collected

| Evidence | Result | What it establishes | What it does not establish |
| --- | --- | --- | --- |
| `next.config.ts` | `poweredByHeader: false`; baseline response headers are configured. | Source intent for application headers. | Headers emitted by a deployed browser-facing response. |
| `deploy/nginx.production.conf` | Internal nginx adds baseline headers, applies API request limiting, and returns `404` for public `/api/metrics`. | Compose-lane proxy design. | A public TLS edge, certificate configuration, or actual ingress topology. |
| `deploy/nginx.public-edge.conf.template` and `deploy/nginx.bare-metal.conf.template` | TLS 1.2/1.3 and HSTS are specified in optional templates. | An operator-facing implementation path exists. | That either template is installed, valid for the host, or active. |
| `src/server/security/request-security.ts` | Same-origin checks, bounded in-process rate limiter, proxy-header opt-in, and no-store helper exist. | Source-level request protections. | Multi-instance/edge behaviour, trusted proxy configuration, or abuse resistance. |
| `src/server/{storefront,admin}/route.ts` | Storefront/admin route wrappers apply Zod parsing, error envelopes, rate limiting, and mutation-origin checks. | Controls on routes using those wrappers. | Exhaustive coverage of every route or live authorization behavior. |
| `src/app/api/users/me/route.ts` | The authenticated profile response is wrapped in `noStore()` on success and failure. | The route declares `Cache-Control: private, no-store, max-age=0` and `Pragma: no-cache`. | Header behavior through a deployed proxy/browser cache. |
| Focused local test commands | Existing security focused tests passed: 4 files, 9 tests. `tests/integration/users-me-route.test.ts` passed: 2 tests for success/failure no-store headers. | Unit/integration contracts for selected helpers/routes. | Deployed headers, TLS, CSP, WAF, proxy, or load behaviour. |

The first test attempt was blocked by the workspace sandbox's filesystem access restriction. It was rerun locally with the required sandbox approval; no network, database, production, or staging target was used.

## Observed application controls

### Browser and transport controls

The source configures these headers in both `next.config.ts` and the internal Compose nginx configuration:

| Header | Observed source value |
| --- | --- |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

`next.config.ts` does **not** configure `Content-Security-Policy` or `Strict-Transport-Security`. The internal Compose nginx file also does not set either header. HSTS is present only in public-edge/bare-metal templates, which are explicitly not installed automatically. No response was fetched, so all header observations are source-level only.

No `Access-Control-Allow-Origin` policy was found in the reviewed application configuration. Browsers therefore have no observed opt-in CORS rule from this source, but actual edge-added CORS behavior has not been tested.

### Authentication, authorization, and mutation safety

- The configured credentials provider is limited to active admin users and verifies passwords with bcrypt. Sessions use the database strategy and an eight-hour maximum age.
- The session and guest-cart cookies are `HttpOnly`, `SameSite=Lax`, and gain `Secure` when `NODE_ENV=production`.
- Admin routes use `withAdminRoute`, which obtains the active actor, requires a typed permission, validates parsed inputs, applies no-store responses, and records safe audit context.
- Storefront mutations routed through `runStoreRoute` require an exact same-origin `Origin` header before parsing JSON. This is a source-level CSRF control; cookies' SameSite behavior and reverse-proxy origin reconstruction were not exercised.
- Public/catalog and mutation schemas are Zod-backed. Generic failures return an `INTERNAL_ERROR` envelope rather than a stack trace.
- The authenticated `/api/users/me` success and failure envelopes now explicitly carry private/no-store headers. The focused integration test proves the route contract locally; no staging response has been observed.

### Rate limiting, logs, and operational endpoints

- The application limiter is an in-memory bounded `Map`. It only trusts `X-Real-IP` when `APPLE333_TRUST_PROXY_HEADERS=true`; the Compose nginx config accepts real-IP data only from loopback and overwrites forwarded headers before proxying.
- Compose nginx applies a `30r/s` API limit with a burst of 60. This is useful edge defense for that topology, but it is not a distributed application limiter and is not verified for a multi-instance or bare-metal route.
- The logger filters known sensitive keys including authorization, cookie, password, OTP, token, national code, and card number before emitting JSON.
- `/api/metrics` is disabled unless `METRICS_ENABLED=true`; the Compose and bare-metal nginx configurations return `404` for public access. Prometheus is intended to reach it on a private network only.
- `/api/health` and `/api/ready` expose dependency state. In the reviewed Compose nginx, both fall through to the general public `/api/` location.

## Findings and required action

Severity below describes the observed control gap, not an unproven live exploit. SEC-511-05 is remediated in the local working tree but still requires staging header verification; all other listed runtime gaps remain open.

| ID | Severity | Finding | Evidence | Required completion evidence |
| --- | --- | --- | --- | --- |
| SEC-511-01 | High-priority control gap | CSP is absent from the reviewed application and internal nginx headers. | `next.config.ts`, `deploy/nginx.production.conf` | Create a CSP design that accounts for Next.js, images, analytics, and Sentry; deploy it in `Report-Only` on isolated staging; collect violation telemetry; then test enforced CSP for the required storefront journeys. |
| SEC-511-02 | High-priority runtime-evidence gap | TLS, HSTS, certificate lifecycle, public edge, and trusted-proxy behavior are templates/assumptions, not observed runtime facts. | optional nginx templates; no staging host accessed | Capture staging `curl -I`/browser evidence over HTTPS, certificate-chain/protocol evidence, redirect behavior, HSTS behavior, and ingress source-IP behavior. |
| SEC-511-03 | High-priority scalability/control gap | Rate limiting is process-local; nginx limiting only applies where the reviewed Compose proxy is the ingress. | `request-security.ts`, `nginx.production.conf` | Define the actual topology, then prove per-client limits and failover behavior under controlled staging load. Add an approved distributed/edge limiter if horizontal scaling or alternate ingress requires it. |
| SEC-511-04 | Medium | Readiness and health responses expose configuration/database/Redis availability, and the general API proxy does not isolate `/api/ready`. | `src/app/api/{health,ready}/route.ts`; nginx API location | Decide whether each endpoint is public liveness, edge-restricted readiness, or private infrastructure readiness. Verify the selected response body and edge rule on staging. |
| SEC-511-05 | Locally remediated; runtime evidence pending | `/api/users/me` now wraps both response paths in `noStore()`, protecting authenticated profile data from shared caching. | `src/app/api/users/me/route.ts`; `tests/integration/users-me-route.test.ts` (2 passing tests) | Fetch authenticated and failure responses through the staging TLS/proxy path and retain redacted `Cache-Control`/`Pragma` evidence. |
| SEC-511-06 | Medium | Metrics isolation depends on the selected runtime lane and `METRICS_ENABLED`; private-network and public-denial behavior is not live-tested. | metrics route; Compose/bare-metal nginx config | Test public `404` and private Prometheus scrape in staging, including an alternate/PM2 deployment path if it remains supported. |
| SEC-511-07 | Moderate | A source review cannot validate authorization boundaries, PIM-content XSS, upload/media authorization, CORS at the edge, or secret exposure. | scope limitation | Run authenticated and unauthenticated staging DAST/manual abuse tests with synthetic accounts and retain redacted evidence. |

## Runtime validation plan (required before approval)

Perform only after an isolated staging environment exists and uses synthetic data and staging-only secrets:

1. Record public HTTPS response headers for `/`, `/products`, authenticated account routes, `/api/health`, `/api/ready`, and `/api/metrics`; save only redacted headers and status codes.
2. Verify HTTP-to-HTTPS redirects, TLS protocol/certificate chain, HSTS decision, and that the app sees only proxy-sanitized client-IP information.
3. Exercise valid and cross-origin/absent-origin cart mutations; retain status codes and sanitized bodies only.
4. Execute controlled per-client rate-limit and burst tests through the actual public ingress and through multiple app instances if applicable.
5. Confirm `api/metrics` is unreachable from the public edge and available only to the intended private collector.
6. Run authenticated RBAC negative tests, media/upload access tests, PIM text XSS probes, and a CSP report-only observation window.
7. Attach scan configuration, tool versions, timestamps, target identity, raw redacted artifacts, and remediation evidence to this report.

## Limitations

- No production/staging URL, network, database, Docker daemon, credentials, or external audit service was accessed.
- No migration, deployment, production configuration change, dependency change, or database change was made by this module. The local source change for SEC-511-05 is documented above and has focused test evidence.
- The focused tests use mocks for readiness and metrics and do not establish a working PostgreSQL/Redis/Prometheus path.
- This report cannot be used as evidence of a real CSP, HSTS, TLS, WAF, secret management, backup, restore, DNS, certificate, CDN, or incident-response configuration.

## Conclusion

The reviewed source contains meaningful security foundations, but Module 07 has not produced the runtime evidence demanded by Phase 05.1.1. Security is **not approved** and Phase 06 must not start on the basis of this report.
