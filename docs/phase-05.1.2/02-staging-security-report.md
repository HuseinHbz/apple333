# Phase 05.1.2 — Staging Security Baseline Report

**Status:** NOT PASSED — static protections exist, but runtime proof is absent and the checked-in assets do not define a `Content-Security-Policy` header.

**Scope:** Read-only source audit of staging Compose/nginx assets, Next.js header configuration, proxy settings, authentication cookie declarations, and CI deployment workflow. No endpoint, certificate, production host, production credential, remote runner, or real staging deployment was accessed.

## Evidence classification

| Evidence | Result | Boundary |
| --- | --- | --- |
| Source and template review | Completed | Static configuration only. It cannot establish what an external TLS edge actually serves. |
| `node scripts/verify-staging-environment.mjs --template` | Passed | String-only staging scaffold validation; it does not make a TLS, Docker, database, or HTTP request. |
| `pnpm test:deploy` | Passed: 11 focused tests | Asset-level checks only; no live headers/cookies/certificates were observed. |
| Runtime HTTP/TLS/cookie inspection | Not executed | No isolated staging endpoint or operator authorization was available. |

## Required header assessment

| Required header | Static source status | Runtime status | Phase result |
| --- | --- | --- | --- |
| `Content-Security-Policy` | **Absent** from `next.config.ts`, `deploy/nginx.production.conf`, and `deploy/nginx.public-edge.conf.template`. | Not observed. | **Fail / blocker.** A runtime edge may add it, but no such configuration or response evidence exists. |
| `Strict-Transport-Security` | Present only in the optional public TLS-edge template and bare-metal TLS template; not in loopback Compose nginx. | Not observed. | Pending external edge evidence. |
| `X-Frame-Options` | `DENY` in Next.js headers, loopback nginx, and public-edge template. | Not observed. | Static candidate only. |
| `X-Content-Type-Options` | `nosniff` in Next.js headers, loopback nginx, and public-edge template. | Not observed. | Static candidate only. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` in Next.js headers, loopback nginx, and public-edge template. | Not observed. | Static candidate only. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` in Next.js headers and nginx templates. | Not observed. | Static candidate only. |

The absence of CSP is a source-level fact, not an inference from a failed HTTP request. It prevents a passing Phase 05.1.2 security baseline under the stated requirements. This report does not authorize a code/configuration change; it records the gap for the next approved improvement cycle.

## Static infrastructure and application controls

### TLS and proxy boundary

- `deploy/compose.staging.yml` publishes nginx only on `127.0.0.1:8081`; its nginx server listens on HTTP port 80 inside the Compose network.
- `deploy/nginx.public-edge.conf.template` is optional, is not installed by scripts, and documents TLS 1.2/1.3 plus HSTS. A real staging TLS configuration therefore remains an external operator control.
- The loopback nginx configuration overwrites `X-Forwarded-For`, passes `X-Real-IP`, and forwards `X-Forwarded-Proto`; Compose sets `APPLE333_TRUST_PROXY_HEADERS=true` for the app.
- `src/server/security/request-security.ts` honors `X-Real-IP` only when that explicit flag is true. This supports the reviewed proxy topology but needs runtime edge verification to ensure client-supplied values cannot bypass it.
- `/api/metrics` returns 404 through nginx, while internal monitoring is intended to use the private app network.

### Cookie declarations

- `src/auth.ts` configures the NextAuth session cookie as `__Secure-apple333.session` in production with `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`.
- `src/server/storefront/guest-cart.ts` sets an `HttpOnly`, `SameSite=Lax`, 30-day guest-cart cookie and adds `Secure` in production.
- These are declarations only. There is no authenticated staging response or guest-cart response in this audit, so no claim is made about actual `Set-Cookie` headers, scope, redirect behavior, or browser enforcement.

### Service isolation and runtime hardening

- PostgreSQL, Redis, and MinIO are private Compose services with no published host ports; nginx is the sole host-published service.
- App containers are non-root, read-only, `no-new-privileges`, capability-dropped, and use bounded resources. This is static Compose configuration, not an inspected runtime container.
- The app readiness route checks configuration, PostgreSQL, and Redis. It does not verify MinIO or application-level object storage. Storage remains deliberately unconfigured in production mode.
- The deployment environment parser requires a `0600` external file, rejects undeclared keys, and uses a closed staging/production Compose selector. This limits misconfiguration but cannot prove the actual environment file or host permission state.

## CI and deployment security limitations

`deploy-staging.yml` checks a clean dedicated checkout, a mode-`0600` external environment file, exact SHA fetch, and an `OWNED_CURRENT` deployment before update. It does not:

1. provision a TLS edge or validate an actual certificate;
2. collect required security headers or cookie evidence;
3. run a CSP test;
4. prove that the GitHub `staging` Environment has required reviewers/branch restrictions;
5. gate deployment directly on the Security workflow; or
6. run a storage access test.

The Security workflow exists as a separate source definition, but no remote run/artifact was inspected during this audit. GitHub branch protection and environment policy are administrative state outside the repository and need separate evidence.

## Authorized staging operator: runtime evidence commands

Run these only on the isolated staging target after a valid, approved bootstrap and deployment. Store redacted outputs under the release evidence record; never send secrets, cookies, authentication headers, private keys, or full configuration files to logs.

Set the non-secret endpoint once:

```bash
export STAGING_ORIGIN='https://staging.apple333.ir'
export STAGING_HOST='staging.apple333.ir'
```

### 1. Capture the complete public header set

```bash
curl --fail --silent --show-error --location \
  --proto '=https' --tlsv1.2 \
  --dump-header phase-05.1.2-public-headers.txt \
  --output /dev/null \
  "$STAGING_ORIGIN/"
grep -Ei '^(content-security-policy|strict-transport-security|x-frame-options|x-content-type-options|referrer-policy|permissions-policy):' \
  phase-05.1.2-public-headers.txt
```

Passing evidence requires all six required headers in the HTTPS response. The expected CSP result for the current checked-in assets is missing until a separately approved fix is deployed; record that failure rather than replacing it with a template claim.

### 2. Validate certificate, hostname, and allowed TLS protocol

```bash
printf '' | openssl s_client \
  -connect "$STAGING_HOST:443" \
  -servername "$STAGING_HOST" \
  -verify_return_error 2>/dev/null \
  | openssl x509 -noout -issuer -subject -dates -ext subjectAltName

curl --fail --silent --show-error \
  --proto '=https' --tlsv1.2 \
  --output /dev/null "$STAGING_ORIGIN/api/ready"
```

Record the certificate issuer, validity dates, and SAN only. Do not record private-key paths, key material, or unrelated virtual-host configuration.

### 3. Verify the active proxy configuration and loopback boundary

```bash
cd /opt/apple333-staging
export APPLE333_ENV_FILE=/etc/apple333/staging.env
docker compose --project-name apple333-staging \
  --env-file "$APPLE333_ENV_FILE" \
  -f deploy/compose.staging.yml exec -T nginx nginx -T \
  | grep -E 'listen |proxy_set_header|real_ip|limit_req|api/metrics'

ss -ltnp | grep -E ':(8081|5432|6379|9000|9001)\\b'
```

Expected evidence: the staging listener is loopback-only, data services are not publicly published, `/api/metrics` is not public, and proxy header forwarding matches the reviewed topology. The external TLS edge must be inspected through the infrastructure change record as well; it is outside the container.

### 4. Validate Secure and HttpOnly cookies with an authorized synthetic account/session

Use a disposable staging-only test account created through the approved test procedure. Do not use real customer or administrator data, and do not save a session token in the evidence file.

```bash
# After an approved synthetic login flow, inspect only cookie attributes.
grep -Ei '^set-cookie:' phase-05.1.2-auth-response-headers.txt \
  | sed -E 's/=[^;]*/=<redacted>/'
```

Required assertion: the session cookie is `__Secure-apple333.session` over HTTPS and includes `Secure`, `HttpOnly`, `SameSite=Lax`, and `Path=/`. A guest-cart response should likewise contain `Secure`, `HttpOnly`, and `SameSite=Lax` in production mode. If attributes differ, preserve the redacted evidence and mark this report failed.

### 5. Observe health without exposing data

```bash
curl --fail --silent --show-error --dump-header - \
  "$STAGING_ORIGIN/api/ready"
curl --silent --show-error --dump-header - --output /dev/null \
  "$STAGING_ORIGIN/api/metrics"
```

`/api/ready` should be healthy only when configuration, PostgreSQL, and Redis pass. The public metrics request should not expose metrics through nginx. Neither response proves object-storage integration.

## Remediation and evidence gates

This report can become **Passed** only when all of the following exist:

1. A deployed CSP implementation and a real HTTPS response containing the required CSP.
2. Redacted public header capture containing all required headers.
3. Certificate/SAN/validity evidence for the staging hostname and TLS 1.2+ handshake evidence.
4. Redacted active proxy/loopback inspection proving the reviewed header trust boundary.
5. Redacted cookie-attribute evidence from a staging-only synthetic session.
6. A recorded GitHub Environment/branch-protection and runner-isolation review.

Until then, no runtime-security or production-readiness approval is justified.
