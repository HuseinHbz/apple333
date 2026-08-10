import { describe, expect, it } from 'vitest';

import { SYSTEM_ROLES } from '@/modules/auth/default-rbac';
import { AuthorizationError } from '@/server/errors/app-error';
import {
  INVENTORY_GLOBAL_ROLE_CODES,
  INVENTORY_BRANCH_SCOPED_ROLE_CODES,
  PERMISSIONS,
  isPermission,
  requireBranchAccess,
  requireGlobalInventoryScope,
  requirePermission,
  resolveInventoryBranchScope,
  type Permission,
  type SessionActor,
} from '@/server/security/permissions';

function actor(
  permissions: readonly Permission[] = [],
  options: Readonly<{ branchId?: string; roleCodes?: readonly string[] }> = {},
): SessionActor {
  return {
    id: 'inventory-actor',
    isAdmin: true,
    roleCodes: options.roleCodes ?? ['BRANCH_MANAGER'],
    permissions: new Set(permissions),
    ...(options.branchId === undefined ? {} : { branchId: options.branchId }),
  };
}

function role(code: string) {
  return SYSTEM_ROLES.find((candidate) => candidate.code === code);
}

describe('Phase 06.1.1 inventory actor matrix policy', () => {
  it.each([
    'branches.read', 'branches.create', 'branches.update',
    'warehouses.read', 'warehouses.create', 'warehouses.update',
    'inventory.read', 'inventory.receive', 'inventory.adjust', 'inventory.transfer',
    'inventory.reserve', 'inventory.release', 'inventory.policy.update',
    'devices.read', 'devices.manage',
  ])('registers the %s permission', (permission) => {
    expect(isPermission(permission)).toBe(true);
  });

  it('defines the five requested actor policies without granting inventory mutations to read-only identities', () => {
    const superAdmin = role('SUPER_ADMIN');
    const inventoryManager = role('INVENTORY_MANAGER');
    const branchManager = role('BRANCH_MANAGER');
    const readOnly = role('READ_ONLY_USER');
    const noPermission = role('NO_PERMISSION_USER');

    expect(superAdmin?.permissions).toHaveLength(PERMISSIONS.length);
    expect(superAdmin?.permissions).toEqual(expect.arrayContaining([...PERMISSIONS]));
    expect(inventoryManager?.permissions).toEqual(expect.arrayContaining([
      'inventory.receive', 'inventory.adjust', 'inventory.transfer',
      'inventory.reserve', 'inventory.release', 'inventory.policy.update',
      'devices.manage',
    ]));
    expect(branchManager?.permissions).toEqual(expect.arrayContaining([
      'inventory.read', 'inventory.receive', 'inventory.adjust', 'inventory.transfer',
      'inventory.reserve', 'inventory.release', 'devices.read',
    ]));
    expect(branchManager?.permissions).not.toEqual(expect.arrayContaining([
      'branches.create', 'warehouses.create', 'inventory.policy.update', 'devices.manage',
    ]));
    expect(readOnly?.permissions).toEqual([
      'dashboard.read', 'products.read', 'branches.read', 'warehouses.read', 'inventory.read', 'devices.read',
    ]);
    expect(noPermission?.permissions).toEqual([]);
  });

  it('allows configured global inventory roles to retain cross-branch scope', () => {
    for (const roleCode of INVENTORY_GLOBAL_ROLE_CODES) {
      const globalActor = actor(['inventory.read'], { roleCodes: ['BRANCH_MANAGER', roleCode] });
      expect(resolveInventoryBranchScope(globalActor)).toBeUndefined();
      expect(() => requireBranchAccess(globalActor, 'branch-b')).not.toThrow();
      expect(() => requireGlobalInventoryScope(globalActor)).not.toThrow();
    }
  });

  it('allows a bound branch manager only in its assigned branch', () => {
    const branchManager = actor(['inventory.read'], { branchId: 'branch-a' });
    expect(resolveInventoryBranchScope(branchManager)).toBe('branch-a');
    expect(() => requireBranchAccess(branchManager, 'branch-a')).not.toThrow();
    expect(() => requireBranchAccess(branchManager, 'branch-b')).toThrow(AuthorizationError);
    expect(() => requireGlobalInventoryScope(branchManager)).toThrow(AuthorizationError);
  });

  it('fails closed when a genuine branch manager has no assigned branch', () => {
    const unboundBranchManager = actor(['inventory.read'], { roleCodes: ['BRANCH_MANAGER'] });
    expect(() => resolveInventoryBranchScope(unboundBranchManager)).toThrow(AuthorizationError);
    expect(() => requireBranchAccess(unboundBranchManager, 'branch-a')).toThrow(AuthorizationError);
    expect(() => requireGlobalInventoryScope(unboundBranchManager)).toThrow(AuthorizationError);
  });

  it('applies the same fail-closed branch contract to warehouse staff', () => {
    expect(INVENTORY_BRANCH_SCOPED_ROLE_CODES).toEqual(expect.arrayContaining(['BRANCH_MANAGER', 'WAREHOUSE_STAFF']));

    const unboundWarehouseStaff = actor(['inventory.read'], { roleCodes: ['WAREHOUSE_STAFF'] });
    expect(() => resolveInventoryBranchScope(unboundWarehouseStaff)).toThrow(AuthorizationError);

    const boundWarehouseStaff = actor(['inventory.read'], { roleCodes: ['WAREHOUSE_STAFF'], branchId: 'branch-a' });
    expect(resolveInventoryBranchScope(boundWarehouseStaff)).toBe('branch-a');
    expect(() => requireBranchAccess(boundWarehouseStaff, 'branch-b')).toThrow(AuthorizationError);
  });

  it('denies missing stock-mutation permissions before a service route can execute', () => {
    expect(() => requirePermission(actor(['inventory.read']), 'inventory.adjust')).toThrow(AuthorizationError);
  });
});
