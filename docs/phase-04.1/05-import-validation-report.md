# Phase 04.1 — import validation and transaction report

## Accepted flow

`CSV -> staging -> validation -> preview -> guarded apply`

Each staged row is retained with raw data and either normalized product input or
row-level validation messages. A batch with any invalid row is terminal
`FAILED`; only fully valid batches become `READY`.

## Fail-closed validation

| Control | Behavior |
| --- | --- |
| Payload bounds | At most 500 rows, 80 fields per row, and 20,000 characters per string cell. Nested JSON objects/arrays are rejected. |
| Required references | Category, brand, and SKU warranty must exist and be active. |
| Identity conflicts | Duplicate slug/SKU in the file, a SKU owned by another product, and an archived product slug are rejected per row. |
| Existing products | Existing slugs are rejected. A full upsert contract for product/variant/SKU changes is not implemented, so partial updates are never silently applied. |
| Source file | A supplied source file must be active `DOCUMENT` media. |
| Apply shape | Stored normalized JSON is revalidated as `CreateProductInput`; bigint rial values are safely re-coerced from JSON strings. |

## Transaction and concurrency behavior

- A `READY -> APPLYING` transition uses a conditional `updateMany` and a
  random apply-attempt token.
- Product creation, SKU creation, row marking, change-journal creation, and
  terminal `COMPLETED` transition occur in one database transaction.
- If that transaction fails, no partial product/row/change write survives; a
  separate conditional transition records `FAILED` with the non-sensitive code
  `PIM_IMPORT_APPLY_FAILED`.
- A process interruption after claiming but before committing has no partial
  business write. After 30 minutes, only a stale `APPLYING` lease may be
  returned to `READY` and atomically reclaimed by one retry.

## Verification status

Focused unit tests cover scalar/bounded payloads, reference/SKU conflicts,
atomic claim failure, and safe failure marking. The isolated PostgreSQL test
adds a post-preview SKU conflict and asserts that the target product, applied
row timestamp, and import change journal were all rolled back. The real
database result remains pending the ephemeral CI job; it is not claimed as a
local pass.
