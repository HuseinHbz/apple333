# Phase 04 - Product Workflow

## Status

**Implemented application workflow; database migration pending.** The PIM
service enforces draft creation, review submission, publication, archive,
optimistic versions, lifecycle events, audit records, active category/brand,
and sellable-SKU gates. Persistence evidence still requires an approved
additive migration and isolated PostgreSQL tests.

No migration has been applied and no existing catalog record has been changed
as part of this documentation work.

## Product lifecycle

```text
DRAFT --submit--> REVIEW --approve--> PUBLISHED --archive--> ARCHIVED
  ^                    |                 |                    |
  +----revise----------+------unpublish---+-----restore--------+
```

| State | Public visibility | Who may move into it | Required controls |
| --- | --- | --- | --- |
| `DRAFT` | Never | Product creator/editor | Incomplete fields permitted; every save is audited. |
| `REVIEW` | Never | `products.update` | Product, variants, SKU validation, media and specification checks pass. |
| `PUBLISHED` | Published projection only | `products.publish` | Explicit approver, unique slug, sellable variant/SKU, valid category/brand, SEO baseline, approved public media. |
| `ARCHIVED` | Never | `products.update` or `products.delete` policy | Reversible visibility state; inventory, cart, historical references, and audit evidence remain intact. |

`products.delete` is a governance permission, not permission to issue an
unconditional SQL delete. The default product removal action is archive or
soft-delete after dependency checks.

## Product authoring flow

1. A product manager selects an existing brand and category, or requests their
   governed creation through the brand/category workflow.
2. The manager creates a `DRAFT` product with title, unique slug, concise and
   complete description, and the intended category.
3. The manager creates each sellable variant. Variant option combinations
   (such as storage, colour, region, and model number) must be unique within a
   product.
4. A SKU record is associated with every sellable variant. The SKU code is
   globally unique; barcode uniqueness applies when a barcode exists.
5. Approved media is attached from the existing media system, ordered, given
   accessible alt text, and assigned a HERO/GALLERY/VIDEO role.
6. The manager selects category-approved specification attributes and values;
   free-form JSON is retained only as a Phase 03 compatibility fallback.
7. SEO fields and structured-data source fields are reviewed.
8. The author submits the product to `REVIEW`. Blocking validation failures
   keep it in `DRAFT` and return field-level diagnostics.
9. A separate authorized approver reviews the product and publishes it, or
   returns it to `DRAFT` with an auditable reason.
10. The PIM emits a safe published projection. The existing storefront reads
    only that projection; it never reads draft or review records directly.

## Category and brand workflow

### Category

- A category may have one nullable parent and must not form a parent cycle.
- Its slug is globally unique; sort order is explicit.
- A category cannot be hard-deleted when active products, children, or a
  dependent specification schema reference it.
- Deactivation removes it from future public discovery while retaining
  historical references and a recovery path.

### Brand

- Apple is an initial data record, not a special code path.
- Brand names and slugs are normalized and unique.
- Logo selection must reference an approved existing `MediaFile`.
- Deactivation is preferred to deletion when products still reference a brand.

## Variant, SKU, warranty, and inventory boundaries

```text
CatalogProduct
  -> CatalogVariant (customer-visible option combination)
      -> ProductSku (commercial identity)
          -> BranchInventory (existing availability boundary)
```

- Phase 04 preserves existing inventory and cart foreign keys to
  `CatalogVariant`; it does not retarget them to a new table.
- SKU creation validates code, optional barcode, cost/price policy, and active
  state before a variant is considered sellable.
- Warranty records provide governed provider/duration/terms. Existing warranty
  text remains a compatibility fallback until audited backfill succeeds.
- Price updates and stock mutation are separate bounded contexts. PIM may store
  product information but must not simulate an order, payment, reservation, or
  stock movement.

## Specification workflow

1. An attribute administrator defines a group (for example, Display), an
   attribute (for example, refresh rate), and its allowed value type.
2. The attribute is scoped to one or more categories.
3. A product manager chooses validated values for the product or specific
   variant.
4. The service builds a normalized public specification projection and search
   projection.
5. Attribute definitions referenced by published products are versioned or
   deactivated; they are not silently deleted or repurposed.

## Media workflow

1. A user with `media.create` uploads a file through the existing media
   boundary, which validates the declared content type, extension, size, and
   storage metadata.
2. A product editor with `products.update` attaches that media ID to a product
   and provides role, order, and alt text.
3. The service permits only approved, non-deleted media and prevents duplicate
   or conflicting hero assignments.
4. A public route exposes media only when it is attached to a published product
   and the file itself is safe for public delivery.
5. Removing an attachment does not delete the underlying media object; media
   lifecycle remains governed by the media module.

## Publication and correction controls

- Publishing must be serialized with a concurrency/version check so an
  approver cannot publish stale content over a newer edit.
- Every state transition records actor, timestamp, previous state, next state,
  request ID, and a safe reason.
- A content correction after publication either updates a non-material safe
  field under policy or moves the product back through `REVIEW`.
- Archiving must invalidate public caches and remove the product from public
  list/search projections without removing historical evidence.

## Phase 03 compatibility workflow

Phase 03 created `CatalogCategory`, `CatalogProduct`, `CatalogVariant`,
`ProductMedia`, `MediaFile`, and public storefront projections. Phase 04
extends these aggregates in place. Before any PIM field becomes mandatory:

1. add it through a reviewed additive migration;
2. backfill in restartable batches with an error report;
3. dual-read and dual-write with Phase 03 fallback fields;
4. run storefront contract and regression tests;
5. obtain explicit approval before constraining or retiring legacy fields.

## Explicit non-goals

This workflow does not create orders, payments, installments, invoices,
fulfilment, stock reservation, supplier purchasing, pricing automation, or a
search-engine cluster. Those require their own approved roadmap scope.

## Roadmap numbering note

The main business roadmap previously labeled installment work as “Phase 4”,
while this delivery brief calls the PIM module “Phase 04”. This document uses
the unambiguous label **Phase 04 PIM / Apple Product Platform**. It does not
renumber, replace, or mark the installment phase complete.
