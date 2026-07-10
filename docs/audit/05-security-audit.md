# Security Audit

## Verified findings

| Area | Finding | Severity | Evidence |
|---|---|---|---|
| Authentication | No session, password, OTP or JWT validation exists | Critical | `server.py` actor handling |
| Authorization | Caller-controlled role header defaults to `admin` | Critical | `server.py` `actor()` and `allow()` |
| Payment | Mock confirmation can mark a pending payment successful | Critical | `server.py` payment confirm route |
| Input validation | JSON parsing exists, but no typed schema validation | High | `server.py` request handlers |
| CSRF | No cookie/session model or CSRF defense | High | static checkout + API |
| Rate limiting | No rate limit for checkout, IMEI lookup, coupon or payment routes | High | `server.py` |
| XSS | Client templates interpolate values through `innerHTML` | High when data becomes external | `storefront.js`, `checkout.html` |
| Secret management | `IMEI_LOOKUP_SALT` has an insecure fallback | High | `server.py`; no value is reported here |
| Database privacy | Raw IMEI/serial values are stored in local SQLite columns | High | `server.py` `devices` schema |
| Logging | Basic console logs; no structured redaction/retention | Medium | `server.py` |
| Deployment | No TLS/WAF/container/secrets/backup configuration tracked | Critical | repository structure |

## Secret scan result

No committed `.env` file or explicit credential value was found in tracked files. The only secret-like runtime variable identified is `IMEI_LOOKUP_SALT` in `server.py`; its fallback must be removed before production.

## Required security gate before any release

Use server-issued sessions, RBAC/branch policy enforced from persisted identity, Zod validation, CSRF protection where cookies are used, CSP/output encoding, rate limits, signed payment webhooks, encrypted sensitive fields, audit redaction, secret vault and independent penetration testing.
