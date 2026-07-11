# Security Baseline

Implemented: strict env validation, ignored secret files, response envelope with request ID, safe `AppError` mapping, baseline response headers, fail-closed auth foundation, permission constants, server-only Prisma, structured logger with sensitive-key suppression and unconfigured storage/cache adapters.

Postponed: real Auth.js provider/session persistence, CSRF token integration, Redis-backed rate limits, CSP nonce policy, payment signatures, encrypted PII and file upload implementation. Legacy `server.py` remains unsafe and is explicitly outside the new runtime path.
