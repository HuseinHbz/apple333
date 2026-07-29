/**
 * Declarative, side-effect-free Phase 06.1 inventory E2E fixtures.
 *
 * Browser tests import this module directly. Do not import the executable
 * seed module for shared credentials or fixture data: its runtime graph owns
 * Prisma setup and must remain separate from Playwright's test transform.
 */
export const TEST_ADMIN_EMAIL = 'e2e-phase0611-inventory-manager@example.test';
export const TEST_ADMIN_PASSWORD = 'E2E-Inventory-Password-2026';
export const ROLE_CODE = 'INVENTORY_MANAGER';
export const BRANCH_ROLE_CODE = 'BRANCH_MANAGER';
export const PRODUCT_SLUG = 'e2e-inventory-iphone';
export const SKU_CODE = 'E2E-INV-IPHONE-256-BLK';
export const BULK_SKU_CODE = 'E2E-INV-BULK-CABLE';
export const SERIAL_SKU_CODE = 'E2E-INV-SERIAL-AIRPODS';
export const IMEI = '490154203237500';

/**
 * These are isolated runtime personas, not operational accounts. Their role
 * codes intentionally match the enterprise policy so runtime scope checks are
 * exercised against genuine actors. The unbound branch manager is a negative
 * security probe and is not part of the commercial actor matrix.
 */
export const E2E_INVENTORY_ACTORS = {
  SUPER_ADMIN: { email: 'e2e-phase0611-super-admin@example.test', name: 'E2E Super Admin', roleCode: 'SUPER_ADMIN', branchCode: null },
  INVENTORY_MANAGER: { email: TEST_ADMIN_EMAIL, name: 'E2E Inventory Manager', roleCode: 'INVENTORY_MANAGER', branchCode: null },
  BRANCH_MANAGER: { email: 'e2e-phase0611-branch-manager@example.test', name: 'E2E Branch A Manager', roleCode: 'BRANCH_MANAGER', branchCode: 'E2E-INV-A' },
  READ_ONLY_USER: { email: 'e2e-phase0611-read-only@example.test', name: 'E2E Read-only User', roleCode: 'READ_ONLY_USER', branchCode: null },
  NO_PERMISSION_USER: { email: 'e2e-phase0611-no-permission@example.test', name: 'E2E No-permission User', roleCode: 'NO_PERMISSION_USER', branchCode: null },
  UNBOUND_BRANCH_MANAGER: { email: 'e2e-phase0611-unbound-branch-manager@example.test', name: 'E2E Unbound Branch Manager', roleCode: 'BRANCH_MANAGER', branchCode: null },
};

/**
 * All values are isolated-test identifiers and must never be reused in
 * operational data. The seed consumes this declaration without changing it.
 */
export const INVENTORY_E2E_FIXTURES = {
  branches: [
    { code: 'E2E-INV-A', name: 'E2E Inventory Branch A', city: 'Test City A', warehouseCode: 'E2E-WH-1', warehouseName: 'E2E Warehouse 1' },
    { code: 'E2E-INV-B', name: 'E2E Inventory Branch B', city: 'Test City B', warehouseCode: 'E2E-WH-2', warehouseName: 'E2E Warehouse 2' },
    { code: 'E2E-INV-C', name: 'E2E Inventory Branch C', city: 'Test City C', warehouseCode: 'E2E-WH-3', warehouseName: 'E2E Warehouse 3' },
    { code: 'E2E-INV-D', name: 'E2E Inventory Branch D', city: 'Test City D', warehouseCode: 'E2E-WH-4', warehouseName: 'E2E Warehouse 4' },
  ],
  skus: {
    imei: {
      code: SKU_CODE,
      productSlug: PRODUCT_SLUG,
      productName: 'Apple333 E2E Inventory iPhone',
      variantTitle: '256GB Black',
      priceRials: 1_499_000_000n,
      trackingMode: 'IMEI',
    },
    serial: {
      code: SERIAL_SKU_CODE,
      productSlug: 'e2e-inventory-airpods',
      productName: 'Apple333 E2E Inventory AirPods',
      variantTitle: 'USB-C White',
      priceRials: 189_000_000n,
      trackingMode: 'SERIAL',
    },
    normal: {
      code: BULK_SKU_CODE,
      productSlug: 'e2e-inventory-cable',
      productName: 'Apple333 E2E Inventory USB-C Cable',
      variantTitle: '1m White',
      priceRials: 49_000_000n,
      trackingMode: 'NONE',
    },
  },
  locations: [
    { code: 'STORAGE', name: 'E2E Storage', type: 'STORAGE', status: 'ACTIVE' },
    { code: 'Z-RECEIVING', name: 'E2E Receiving', type: 'RECEIVING', status: 'ACTIVE' },
    { code: 'Z-PICKUP', name: 'E2E Pickup', type: 'PICKUP', status: 'ACTIVE' },
    { code: 'Z-QUARANTINE', name: 'E2E Quarantine', type: 'QUARANTINE', status: 'ACTIVE' },
    { code: 'Z-DAMAGED', name: 'E2E Damaged', type: 'DAMAGED', status: 'ACTIVE' },
  ],
  inactiveWarehouse: {
    branchCode: 'E2E-INV-B',
    code: 'E2E-WH-2-INACTIVE',
    name: 'E2E Disabled Warehouse',
    status: 'DISABLED',
    location: { code: 'STORAGE', name: 'E2E Disabled Storage', type: 'STORAGE', status: 'DISABLED' },
  },
};
