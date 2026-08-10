# Payment Security Design

- Browser payloads never contain authoritative amount or currency.
- Callback bodies/query strings are hostile input and validated with strict
  Zod schemas, bounded field lengths, allowlisted providers, and replay keys.
- Callback signature validation uses constant-time comparison; only a payload
  hash and safe decision metadata are persisted.
- Browser redirects display state but cannot verify or complete payment.
- Verification queries the provider server-side and requires matching payment,
  authority, amount, currency, and provider status.
- Durable PostgreSQL idempotency protects financial operations across restarts;
  Redis may not be the financial source of truth.
- Same-origin checks protect browser mutations. Provider callbacks use
  signature/replay controls and a bounded callback rate limit instead of
  browser-origin checks.
- The simulator fails closed in normal production runtime before any Payment
  mutation. Its production-artifact exception requires all disposable E2E
  markers plus the exact loopback Phase 08 database identity.
- Provider execution enforces an abort signal, a configurable response timeout
  clamped to 30 seconds, and at most two attempts for read-only or
  provider-idempotent operations. The simulator exposes timeout/network-retry
  outcomes as canonical errors.
- Provider results are runtime-checked for canonical status, money, currency,
  references, expiry and safe HTTP(S) redirects before persistence or browser
  exposure.
- Logs contain request ID, payment/order IDs, provider, operation, result, and
  duration only; no secret, raw callback, token, card data, or full PII.
- Customer ownership, branch scope, and dedicated financial permissions are
  enforced in repository/service/route projections.
- PAN, CVV, cardholder authentication data, and gateway secrets are never
  accepted or stored.
