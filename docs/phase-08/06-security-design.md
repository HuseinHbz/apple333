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
  signature/replay controls instead of browser-origin checks.
- Provider calls use explicit connect/response timeouts and bounded retry.
- Logs contain request ID, payment/order IDs, provider, operation, result, and
  duration only; no secret, raw callback, token, card data, or full PII.
- Customer ownership, branch scope, and dedicated financial permissions are
  enforced in repository/service/route projections.
- PAN, CVV, cardholder authentication data, and gateway secrets are never
  accepted or stored.
