# Phase 01 nginx architecture

## Architecture decision

Apple333 uses two reverse-proxy layers in the production design:

1. an organization-managed TLS edge proxy or load balancer owns the public
   hostname, certificates, HTTP-to-HTTPS redirect, and internet-facing policy;
2. the repository-managed nginx container proxies loopback traffic to the
   Next.js application on the private Docker network.

The canonical implementation is
[`deploy/nginx.production.conf`](../../deploy/nginx.production.conf), launched
by [`deploy/compose.production.yml`](../../deploy/compose.production.yml). The
container binds to `127.0.0.1:8080` by default and does not manage certificates.
This avoids overwriting an existing server-wide virtual host or exposing
PostgreSQL and Redis.

## Request path

```text
Browser
  -> public DNS and approved TLS edge (443)
  -> loopback-bound Apple333 nginx (127.0.0.1:8080)
  -> app service (private Docker network, port 3000)
  -> PostgreSQL / Redis (private Docker network only)
```

## Current controls and verified limits

| Topic | Repository state | Release implication |
| --- | --- | --- |
| Proxying | The loopback nginx trusts `X-Forwarded-For` only from the host-local TLS edge, derives a real client address, and overwrites the headers sent to `app:3000`. | Do not expose the bundled port or add trusted CIDRs without reviewing the application rate-limit trust boundary. |
| Container exposure | nginx only publishes the configured host bind/port; app uses `expose: 3000`. | PostgreSQL and Redis remain un-published. |
| Basic headers | Bundled nginx sets `nosniff`, framing, referrer, and permissions policies; Next.js also sets baseline headers. | Review duplicate/header precedence at staging. |
| TLS redirect and HSTS | `deploy/nginx.public-edge.conf.template` implements the dedicated public TLS redirect/HSTS design. | It is an operator-reviewed template, not an automatic change to an existing server virtual host. |
| Compression and static cache policy | Bundled nginx enables gzip and long-lived immutable caching for `/_next/static/`. | Validate route behavior and edge/CDN interaction at staging. |
| WebSocket upgrade handling | Bundled nginx forwards `Upgrade`/`Connection` and uses bounded proxy timeouts. | Validate a real realtime endpoint before claiming end-to-end WebSocket evidence. |
| Content Security Policy | Not currently defined. | Design a report-only CSP first, then enforce after staging validation. |

The bundled API limiter uses the sanitized real client address only after the
managed Compose stack explicitly enables trusted proxy headers. Direct Next.js
or PM2 runs do not opt in, so they must not be treated as a public production
edge. A distributed/edge limiter remains required for multi-instance coverage.

## Required public-edge configuration

The team operating the public proxy must configure a dedicated Apple333
hostname rather than changing a shared catch-all virtual host. Before go-live,
verify all of the following:

- redirect port 80 to the canonical HTTPS origin, except any narrowly scoped
  certificate-challenge endpoint;
- TLS 1.2+ (prefer TLS 1.3), managed certificate renewal, and modern ciphers;
- HSTS only after HTTPS is stable for every intended subdomain;
- upstream routing only to the loopback Apple333 nginx port;
- request-size, timeout, and upload policy matched to product/media needs;
- security headers without unsafe overrides; and
- access/error logs retained under the organization logging policy, with no
  secrets, session cookies, or full authorization headers logged.

Do not treat a reverse-proxy example as an authorization to edit a server's
existing certificate or virtual-host configuration. Review the host's current
configuration, create an Apple333-specific site, validate it, and retain a
rollback copy before activation.

## Render, validate, activate, and roll back the public-edge template

`deploy/nginx.public-edge.conf.template` is deliberately a template. Its
`${APPLE333_*}` placeholders are not a ready-to-load nginx configuration and
must not be copied into an active virtual-host directory unchanged. Rendering
and activating it are infrastructure-operator responsibilities because the
operator owns the public hostname, certificates, ACME path, and any existing
sites.

Use this controlled procedure on staging first:

1. Inspect the active nginx configuration and record the exact current
   Apple333-independent site revision. Do not modify a shared catch-all site or
   another application's certificate configuration.
2. Create a dedicated Apple333 site in the host's approved configuration
   location. Substitute only the reviewed values for public server name, ACME
   webroot, certificate path, certificate-key path, and Apple333 loopback port.
   Use the organization's reviewed configuration-management or templating
   process; do not put certificate private keys or production values into Git.
3. Review the rendered diff. Confirm no `${APPLE333_*}` placeholders remain,
   the upstream is the intended loopback address/port, certificate/private-key
   permissions meet host policy, and HSTS scope is approved.
4. Validate the complete nginx configuration before reloading:

   ```bash
   sudo nginx -t
   ```

   If validation fails, stop and leave the active configuration unchanged.
5. Activate only the dedicated site through the host's approved mechanism, then
   reload without a restart:

   ```bash
   sudo systemctl reload nginx
   ```

6. Test the canonical HTTPS origin, HTTP redirect/ACME exception, certificate
   chain, headers, static cache behavior, a normal application page, and a
   failed-upstream response. Attach redacted results to the staging release
   record before a production change.

Prepare rollback **before** activation: retain the prior approved site revision
and its activation state, together with the command that restored it. If a
public-edge change fails validation or routing checks, restore that prior
Apple333-specific revision, run `sudo nginx -t`, reload nginx, and verify the
previous HTTPS path. Do not roll back by replacing a shared global nginx
configuration, deleting unrelated virtual hosts, or changing application data.

## Header policy

The application currently supplies `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
and a restrictive `Permissions-Policy` for camera, microphone, and geolocation.
The edge should preserve or deliberately supersede those values. Required
review items are:

| Header | Desired policy | Status |
| --- | --- | --- |
| `Strict-Transport-Security` | Enable at the TLS edge after HTTPS validation. | Included in the public-edge template; pending host validation. |
| `Content-Security-Policy` | Start report-only; inventory Next.js assets, analytics, Sentry, and storage origins before enforcing. | Pending design and staging evidence. |
| `X-Content-Type-Options` | `nosniff`. | Present in app and bundled nginx. |
| `X-Frame-Options` / CSP `frame-ancestors` | Deny framing unless a product requirement explicitly changes it. | `X-Frame-Options` present; CSP requires a report-only rollout. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` or stricter after compatibility review. | Present. |
| `Permissions-Policy` | Disable unused browser capabilities. | Baseline present; review feature needs. |

## Caching, compression, and realtime readiness

Next.js hashed static assets can be cached aggressively only after confirming
their cache-control headers and deployment behavior. Dynamic HTML, account,
cart, checkout, and authenticated API responses must not be shared-cacheable.
Compression must be tested against response types and any proxy/CDN behavior to
avoid double compression.

If a future feature uses WebSockets or Server-Sent Events, add an explicit
edge/proxy design covering `Upgrade`/`Connection` headers where needed,
read/write timeouts, buffering, connection limits, and load-balancer affinity.
No current repository evidence proves a realtime endpoint is deployed.

## Operational validation

On staging, test:

```bash
curl -I https://staging.example.com/
curl -fsS https://staging.example.com/api/health
curl -fsS https://staging.example.com/api/ready
```

Also verify certificate chain, redirect behavior, headers, static asset cache
headers, application logs, and a failed-upstream response. Docker/runtime
execution has not been evidenced by this documentation; record real command
output in the phase completion evidence before production approval.
