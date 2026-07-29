# Phase 07 RBAC Matrix

Permission checks occur in both the route boundary and the order service.
Branch scope is resolved fail-closed: a branch-scoped actor without an assigned
branch has no order visibility or mutation capability.

| Capability | Permission | Typical roles | Scope |
| --- | --- | --- | --- |
| Read operational order data | `orders.read` | Super admin, order manager, branch manager | Global or assigned branch |
| Read own customer orders | `orders.read_own` | Customer | Own `customerId` only |
| Create storefront order | `orders.create` | Customer / approved guest policy | Own cart only |
| Create assisted order | `orders.create_admin` | Order manager, branch manager | Authorized branch |
| Update non-financial metadata | `orders.update` | Order manager | Authorized branch |
| Confirm | `orders.confirm` | Order manager, branch manager | Authorized branch |
| Cancel pre-payment order | `orders.cancel` | Order manager, branch manager | Authorized branch |
| Cancel paid order | `orders.cancel_after_payment` | Finance operator | Global finance scope |
| Allocate | `orders.allocate` | Order manager, branch manager | Authorized branch |
| Fulfill | `orders.fulfill` | Order manager, branch operator | Authorized branch |
| View financial totals | `orders.view_financials` | Finance/order manager | Explicit permission |
| View customer PII | `orders.view_customer_pii` | Order/branch manager | Explicit permission |
| View full IMEI/serial | `orders.view_imei` | Explicit device-authorized role | Explicit permission |
| Add internal notes | `orders.add_internal_note` | Operational staff | Authorized branch |
| Read audit trail | `orders.audit.read` | Super admin, auditor, finance | Explicit permission |
| Export orders | `orders.export` | Authorized manager | Explicit permission |

Public/customer projections are deliberately separate from admin projections.
They never contain internal notes, audit metadata, full IMEIs, branch-only
allocation data, provider references, or finance fields that the caller is not
allowed to view.
