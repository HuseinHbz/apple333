# Phase 03 — Admin Security Model

## Security objective

The admin platform processes operational, customer, financial, and security
metadata. Its security model therefore requires verified authentication,
server-side authorization, request validation, auditability, and privacy-safe
observability. The intended posture is fail closed: absent or unverified session
state must never be treated as administrative access.

## Control layers

| Layer | Required control |
| --- | --- |
| Route/layout | Redirect or reject unauthenticated admin access without rendering protected data |
| API route | Resolve actor, assign/request a request ID, validate input, authorize permission and scope |
| Service | Enforce invariants such as protected roles, self-lockout prevention, and immutable audit rules |
| Repository | Use scoped, minimal projections; never trust client-provided ownership/scope |
| Storage/media | Validate type, extension, size, ownership, and authorization before persistence or retrieval |
| Observability | Structured logs and audit records redacted for secrets and unnecessary PII |

## Authentication and session requirements

- Use an Auth.js-compatible, server-verified session design; never trust a
  browser-provided role or identity header.
- Cookies are `httpOnly`, `secure` in production, scoped, and use an
  appropriate SameSite policy.
- Expiry, rotation, logout, inactive-account handling, and session revocation
  must be implemented at the server/session layer.
- Administrator MFA is a future hardening requirement; until it is implemented,
  deployment policy should compensate with restricted access and monitoring.

## Authorization and IDOR prevention

- Evaluate `resource.action` permissions on every protected route and mutation.
- Check branch/business ownership before retrieving or modifying a record.
- Do not use a user-supplied `userId`, `branchId`, or role code as proof of
  entitlement.
- Keep lists and counts scoped, not just detail endpoints.
- Return safe error responses that do not disclose protected record existence.

## Request and response safety

- Parse path, query, and body input with Zod at the route boundary.
- Apply size limits and allow-lists to uploaded content.
- Use a standard response envelope with a request ID and safe public error
  codes/messages; do not return stacks, database errors, secret values, or
  filesystem paths.
- Use CSRF-aware patterns for cookie-authenticated mutations. SameSite is a
  defense in depth mechanism, not a substitute for a complete CSRF design.
- Prepare rate limiting for login, write, upload, and enumeration-sensitive
  endpoints; production enforcement should be backed by shared infrastructure.

## Media-specific safeguards

Only accepted image, video, and document MIME types/extensions should enter the
media workflow. Verify file signature where practical, cap size, generate an
opaque storage key, avoid executable serving, and scan content before public
availability where an antivirus/scanning service is configured. Database records
store metadata, not file bytes or secrets.

## Audit and logging

Administrative mutations generate append-only audit events with actor, action,
entity type/ID, request ID, timestamp, and a redactable change summary. The
audit viewer is read-only and separately authorized. Application logs must avoid
passwords, OTPs, authentication tokens, authorization headers, full sensitive
settings, and raw identity numbers.

## Residual-risk register

The following controls require implementation and operational verification
before production sign-off if they are not already evidenced by source code and
tests: a live Auth.js provider/session store, CSRF mechanism, distributed rate
limiting, enforced MFA, malware scanning, key rotation, backup/restore testing,
and security monitoring/alerting. Documentation of a control does not establish
that it is active.
