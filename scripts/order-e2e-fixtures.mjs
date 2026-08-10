/**
 * Declarative, side-effect-free Phase 07 browser fixtures. The executable
 * seed imports this module, while Playwright tests use it without importing
 * Prisma or any process-owning script.
 */
export const ORDER_E2E_PASSWORD = "E2E-Order-Password-2026";

export const ORDER_E2E_ACTORS = Object.freeze({
  CUSTOMER: Object.freeze({
    id: "c000000000000000000000009",
    email: "e2e-phase07-customer@example.test",
    name: "E2E Order Customer",
    roleCode: "CUSTOMER",
  }),
  CUSTOMER_OTHER: Object.freeze({
    id: "c000000000000000000000012",
    email: "e2e-phase07-customer-other@example.test",
    name: "E2E Other Customer",
    roleCode: "CUSTOMER",
  }),
  ORDER_MANAGER: Object.freeze({
    id: "c000000000000000000000010",
    email: "e2e-phase07-order-manager@example.test",
    name: "E2E Order Manager",
    roleCode: "ORDER_MANAGER",
  }),
});

export const ORDER_E2E_FIXTURES = Object.freeze({
  customerAddress: Object.freeze({
    id: "c000000000000000000000011",
    label: "E2E delivery address",
    recipientName: "E2E Order Customer",
    mobile: "09120000000",
    province: "Tehran",
    city: "Tehran",
    line1: "Phase 07 isolated test address",
    postalCode: "1111111111",
  }),
  category: Object.freeze({
    id: "c000000000000000000000001",
    slug: "e2e-phase07-order-category",
    name: "E2E Phase 07 Order Category",
  }),
  product: Object.freeze({
    id: "c000000000000000000000002",
    slug: "e2e-phase07-order-iphone",
    name: "Apple333 E2E Order iPhone",
  }),
  variant: Object.freeze({
    id: "c000000000000000000000003",
    sku: "E2E-ORDER-IP-256-BLK",
    title: "256GB Black",
    priceRials: 1_499_000_000n,
  }),
  productSku: Object.freeze({
    id: "c000000000000000000000004",
    code: "E2E-ORDER-IP-256-BLK",
  }),
  branch: Object.freeze({
    id: "c000000000000000000000005",
    code: "E2E-ORDER-BRANCH",
    name: "E2E Order Branch",
  }),
  warehouse: Object.freeze({
    id: "c000000000000000000000006",
    code: "E2E-ORDER-WH",
    name: "E2E Order Warehouse",
  }),
  location: Object.freeze({
    id: "c000000000000000000000007",
    code: "STORAGE",
    name: "E2E Order Storage",
  }),
  inventoryItem: Object.freeze({
    id: "c000000000000000000000008",
    quantity: 12,
  }),
});

export const ORDER_E2E_ROLE_PERMISSIONS = Object.freeze({
  CUSTOMER: Object.freeze(["orders.read_own", "orders.create"]),
  ORDER_MANAGER: Object.freeze([
    "orders.read",
    "orders.create_admin",
    "orders.confirm",
    "orders.cancel",
    "orders.allocate",
    "orders.fulfill",
    "orders.view_financials",
    "orders.view_customer_pii",
    "orders.add_internal_note",
    "orders.audit.read",
  ]),
});
