# Phase 04 - Product Platform Security Report

## Assessment status

**Implementation assessment - not a production security sign-off.** The PIM
routes use the existing authentication/RBAC foundation, administrative route
wrapper, request ID propagation, same-origin mutation guard, rate limiting,
structured logging, audit context, and media-kind controls. A migration-backed
security and persistence review is still required before production release.

No database migration, destructive database command, product data change, or
production security configuration change has been executed in Phase 04.

## Security objectives

1. Only authenticated, authorized actors may change product information.
2. Public consumers receive only published, allow-listed data.
3. Imports and media cannot turn untrusted input into catalog data or public
content without validation.
4. Product lifecycle and critical commercial changes are attributable and
auditable.
5. Catalog operations remain safe under concurrent edits, malformed requests,
and high-volume listings.

## Permission model

The existing RBAC vocabulary is the required baseline:

| Resource | Read | Create | Update | Delete / special |
| --- | --- | --- | --- | --- |
| Products | `products.read` | `products.create` | `products.update` | `products.delete`, `products.publish` |
| Categories | `categories.read` | `categories.create` | `categories.update` | `categories.delete` |
| Brands | `brands.read` | `brands.create` | `brands.update` | `brands.delete` |
| Attributes | `attributes.read` | `attributes.create` | `attributes.update` | `attributes.delete` |
| Warranties | `warranties.read` | `warranties.create` | `warranties.update` | `warranties.delete` |
| Imports | `product-imports.read` | `product-imports.create` | n/a | `product-imports.apply` |
| Media attachment | `media.read` | existing `media.create` | product update policy | existing `media.delete` |

All planned `/api/admin/*` PIM routes must use `withAdminRoute` and enforce a
single, explicit permission. UI visibility is not authorization; the service
and route boundary must enforce it independently.

## Threats and required controls

| Threat | Required control | Evidence required before acceptance |
| --- | --- | --- |
| IDOR / cross-tenant object access | Authenticated actor, role checks, constrained ID lookup, branch scope where applicable | Negative integration tests for every mutation. |
| Mass assignment | Strict Zod object schemas and explicit DTO-to-domain mapping | Unknown-key and privileged-field tests. |
| Draft data exposure | Public repository filters on published/active/non-deleted state; explicit DTOs | Anonymous API and sitemap tests. |
| Lifecycle bypass | Separate `products.publish` permission, state transition guard, optimistic concurrency | Tests for invalid transitions and stale approval. |
| SKU/barcode collision | DB unique constraints plus service validation and conflict handling | Concurrent integration test after migration review. |
| Unsafe media | Existing upload validation plus attachment allow-list, public media gate, content-disposition policy | Invalid type/size/deleted media tests. |
| CSV/XLSX formula or parser attack | Strict limits, no macro execution, escaped export/report values, staged parsing | Fuzz/limit and formula-injection tests. |
| SSRF via media/canonical/import URL | Use stored media IDs and same-origin canonical paths; do not fetch arbitrary URLs | Validator and negative route tests. |
| Injection / unsafe rich text | Prisma parameterization, no raw dynamic SQL, sanitized render path | Static review plus XSS/escaping tests. |
| Sensitive data leakage | Public DTO allow-list, safe errors, redacted logs, signed/admin-only media paths | Snapshot/API contract tests. |
| Replay or repeated import apply | Idempotency key, batch revision, immutable change journal | Double-submit/concurrency integration tests. |
| Denial of service | Request/file/row limits, pagination limits, rate limits, bounded query selects | Load and boundary tests. |

## Audit and accountability

The implementation must write an audit event for product, category, brand,
attribute, warranty, media-association, SEO, lifecycle, and import operations.
An event includes actor ID, request ID, action, entity ID/type, safe before/after
summary or transition values, source IP/user agent where the platform captures
them, and timestamp. It must not store raw import rows, credentials, full
storage keys, or sensitive commercial data in public logs.

## Database and migration safety

- Phase 04 changes are additive until an approved backfill and data-quality
  report exist.
- A generated migration must be reviewed for table locks, enum changes,
  unique-index build strategy, FK actions, and rollback/compensation steps.
- `prisma migrate reset`, destructive drops, truncation, and shared/production
  `prisma db push` are prohibited.
- Hard deletes are not a substitute for archival, especially where storefront,
  cart, inventory, or audit relations exist.

## Open security gaps to close

1. Validate the final PIM endpoints against a real migration in an isolated
   PostgreSQL environment.
2. Verify authorization for each new route and server action, including
   unpublished product/media paths.
3. Define malware scanning/quarantine and image transformation policy before
   accepting supplier-originated media at scale.
4. Add import rate/size/row operational limits and alert thresholds.
5. Review retention and access policy for import source files and change
   journals.
6. Run dependency, SAST, and authenticated dynamic security checks in CI or a
   controlled staging environment.

## Preliminary conclusion

The architectural direction is suitable for a secure PIM only if the above
controls are implemented and tested. Current evidence is insufficient for a
production security approval or the requested 9.8/10 quality gate.
