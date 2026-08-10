import { describe, expect, it } from 'vitest';

import { seed } from '../../scripts/seed-e2e-inventory.mjs';
import {
  BRANCH_ROLE_CODE,
  E2E_INVENTORY_ACTORS,
  INVENTORY_E2E_FIXTURES,
  SKU_CODE,
  SERIAL_SKU_CODE,
  BULK_SKU_CODE,
} from '../../scripts/inventory-e2e-fixtures.mjs';

describe('Phase 06.1 deterministic inventory E2E fixtures', () => {
  it('declares four branch-owned active warehouses and one disabled warehouse', () => {
    expect(INVENTORY_E2E_FIXTURES.branches).toHaveLength(4);
    expect(INVENTORY_E2E_FIXTURES.branches.map((branch) => branch.code)).toEqual([
      'E2E-INV-A',
      'E2E-INV-B',
      'E2E-INV-C',
      'E2E-INV-D',
    ]);
    expect(INVENTORY_E2E_FIXTURES.branches.every((branch) => branch.warehouseCode.startsWith('E2E-WH-'))).toBe(true);
    expect(INVENTORY_E2E_FIXTURES.inactiveWarehouse).toMatchObject({
      branchCode: 'E2E-INV-B',
      status: 'DISABLED',
      location: { status: 'DISABLED' },
    });
  });

  it('declares normal, serial, and IMEI tracking modes plus required location types', () => {
    expect(INVENTORY_E2E_FIXTURES.skus).toMatchObject({
      imei: { code: SKU_CODE, trackingMode: 'IMEI' },
      serial: { code: SERIAL_SKU_CODE, trackingMode: 'SERIAL' },
      normal: { code: BULK_SKU_CODE, trackingMode: 'NONE' },
    });
    expect(INVENTORY_E2E_FIXTURES.locations.map((location) => location.type)).toEqual(expect.arrayContaining([
      'RECEIVING',
      'STORAGE',
      'PICKUP',
      'QUARANTINE',
      'DAMAGED',
    ]));
    expect(BRANCH_ROLE_CODE).toBe('BRANCH_MANAGER');
  });

  it('declares exact Phase 06.1.1 actor personas and an isolated unbound negative probe', () => {
    expect(E2E_INVENTORY_ACTORS).toMatchObject({
      SUPER_ADMIN: { roleCode: 'SUPER_ADMIN', branchCode: null },
      INVENTORY_MANAGER: { roleCode: 'INVENTORY_MANAGER', branchCode: null },
      BRANCH_MANAGER: { roleCode: 'BRANCH_MANAGER', branchCode: 'E2E-INV-A' },
      READ_ONLY_USER: { roleCode: 'READ_ONLY_USER', branchCode: null },
      NO_PERMISSION_USER: { roleCode: 'NO_PERMISSION_USER', branchCode: null },
      UNBOUND_BRANCH_MANAGER: { roleCode: 'BRANCH_MANAGER', branchCode: null },
    });
    expect(new Set(Object.values(E2E_INVENTORY_ACTORS).map((actor) => actor.email)).size)
      .toBe(Object.keys(E2E_INVENTORY_ACTORS).length);
  });

  it('fails closed before it can call Prisma when test-only acknowledgement is absent', async () => {
    await expect(seed({}, {
      NODE_ENV: 'test',
      INVENTORY_TEST_DATABASE_URL: 'postgresql://apple333_phase06_test:local-test-password@127.0.0.1:55433/apple333_phase06_test?schema=public',
      APPLE333_E2E_TEST_DB: '1',
    })).rejects.toThrow('APPLE333_TEST_DB must be exactly "1".');
  });
});
