# Phase 06 — Security Review

**Review status:** implementation review complete; final operational approval
awaits isolated database, browser, and performance evidence.

## Authorization matrix

| Capability | Admin / Super Admin | Inventory Manager | Branch Manager | Warehouse Staff |
| --- | --- | --- | --- | --- |
| Read all inventory | Yes | Yes | Assigned branch only | Assigned branch only |
| Create/update branches | Yes | Yes | No | No |
| Create/update warehouses | Yes | Yes | No | No |
| Receive/adjust/transfer | Yes | Yes | Assigned branch only | Assigned branch only |
| Create/release reservation | Yes | Yes | Assigned branch only | Assigned branch only |
| Set SKU tracking policy | Yes | Yes | No | No |
| Read masked device list | Yes | Yes | Assigned branch only | Assigned branch only |
| Device policy/management | Yes | Yes | No | No |

Authorization is enforced in the route and, critically, again in the service
after resolving the actual branch of the requested location/balance/device.
Client navigation and query filtering are not treated as access control.

## Controls implemented

- Strict Zod schemas reject unknown fields, malformed CUIDs, unsafe keys,
  invalid quantity, duplicate device IDs, malformed IMEI/serial, and
  same-location transfer requests before service execution.
- IMEI is normalized, a 15-digit IMEI is Luhn validated, and global unique
  constraints protect against concurrent duplicate persistence.
- All stock operations use serializable Prisma transactions, optimistic
  inventory balance versions, invariant checks, append-only movements, and
  idempotency keys.
- Idempotent replays reauthorize their persisted location or reservation at
  the service layer. A branch-scoped actor cannot use a known replay key to
  read or replay work performed in another branch.
- Database checks protect non-negative quantity/reservation values and enforce
  `availableQuantity = quantity - reservedQuantity`.
- Tracked transfer and reservation require the exact device units; those units
  change `inventoryItemId` or reservation/status atomically. Generic adjustment
  is rejected for tracked SKUs rather than allowing inventory/device drift.
- Audit entries record actor, request ID, action, reference/reason, and safe
  before/after balance snapshots. Raw IMEI and serial values are excluded.
- Administrative mutation routes require an equal `Origin` and request origin,
  are rate limited, and return `no-store` responses.
- Public availability sends only availability bands, never counts or device
  identifiers. The endpoint is rate limited and no-store.
- PIM archive protection includes inventory balances, movements, device units,
  reservations, existing branch projection, and cart references.

## Findings and disposition

| Finding | Severity | Disposition |
| --- | --- | --- |
| Legacy `BranchInventory` is still a compatibility projection while canonical location balances are introduced. | Medium | Writes update both atomically. A separately approved reconciliation/cutover is required before replacing legacy reads. |
| `AdminUser.branchId` remains an unconstrained string in the prior schema. | Medium | Service-level branch checks remain mandatory. Add an FK only after a migration preflight proves no existing orphan records. |
| Device sale, return inspection, damage, and expiry job semantics belong to later workflows. | Low | Phase 06 refuses unsafe generic adjustment for tracked units; Phase 07+ must provide explicit, audited device transitions. |
| Production migration and RBAC adoption have not been executed. | High operational risk | Out of scope here; require reviewed migration report, backup, dry-run, operator approval, and post-change verification. |

## Review conclusion

No raw device identifier is intentionally selected into storefront DTOs or
audit metadata. The remaining risks are controlled adoption and future
workflow risks, not an authorization bypass in the Phase 06 surface.
