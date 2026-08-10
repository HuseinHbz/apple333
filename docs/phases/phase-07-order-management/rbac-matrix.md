# Phase 07 RBAC Matrix

Permission checks occur in both the route boundary and `OrderService`. Branch
scope resolves fail-closed: a branch-scoped actor without an assigned permitted
branch cannot read or mutate its orders. Customer scope is always the resolved
`customerId`, never an order number alone.

| Capability                             | Permission                    | Typical roles                              | Scope / additional rule                                                                            |
| -------------------------------------- | ----------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Read operational order data            | `orders.read`                 | Super admin, order manager, branch manager | Global or assigned branch                                                                          |
| Read own customer orders               | `orders.read_own`             | Customer                                   | Own `customerId` only                                                                              |
| Create storefront order                | `orders.create`               | Customer                                   | Own authenticated cart only                                                                        |
| Create assisted order                  | `orders.create_admin`         | Order manager, branch manager              | Target branch checked before reservation/write                                                     |
| Add customer-visible note              | `orders.update`               | Order manager                              | Authorized branch; no general order-update endpoint                                                |
| Confirm                                | `orders.confirm`              | Order manager, branch manager              | Authorized branch                                                                                  |
| Cancel normal order                    | `orders.cancel`               | Order manager, branch manager              | Authorized branch and lifecycle policy                                                             |
| Cancel after payment                   | `orders.cancel_after_payment` | Finance operator                           | Finance/lifecycle policy, no settlement                                                            |
| Allocate                               | `orders.allocate`             | Order manager, branch manager              | Authorized branch                                                                                  |
| Fulfill                                | `orders.fulfill`              | Order manager, branch operator             | Authorized branch                                                                                  |
| View financial totals/payment attempts | `orders.view_financials`      | Finance/order manager                      | Explicit field permission                                                                          |
| View customer PII                      | `orders.view_customer_pii`    | Authorized manager                         | Explicit field permission plus PII-view audit                                                      |
| View full IMEI/serial                  | `orders.view_imei`            | Device-authorized role                     | Explicit field permission plus authorized administrative order access; no default role receives it |
| Add internal notes                     | `orders.add_internal_note`    | Operational staff                          | Authorized branch; requires an idempotency key                                                     |
| Read audit timeline                    | `orders.audit.read`           | Super admin, auditor, finance              | Explicit permission                                                                                |
| Export orders                          | `orders.export`               | Authorized manager                         | Explicit permission; no OMS export endpoint in Phase 07                                            |

Customer/public projections deliberately exclude internal notes, audit metadata,
full IMEIs/serials, branch-only allocation data, and provider references.
Financial fields are omitted or `null`, and payment attempts are empty, for an
admin caller lacking `orders.view_financials`. Customer PII is masked/null
without `orders.view_customer_pii`. These rules are enforced by projection
mappers as well as route/service authorization.
