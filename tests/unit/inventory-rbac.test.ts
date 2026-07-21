import { describe, expect, it } from 'vitest';

import { SYSTEM_ROLES } from '@/modules/auth/default-rbac';
import { AuthorizationError } from '@/server/errors/app-error';
import { isPermission, requireBranchAccess, requirePermission, type SessionActor } from '@/server/security/permissions';

function actor(permissions: readonly Parameters<typeof requirePermission>[1][], branchId?: string): SessionActor {
  return { id: 'inventory-admin', isAdmin: true, roleCodes: ['INVENTORY_MANAGER'], permissions: new Set(permissions), ...(branchId ? { branchId } : {}) };
}

describe('inventory RBAC policy', () => {
  it.each([
    'branches.read', 'branches.create', 'branches.update', 'warehouses.read', 'warehouses.create', 'warehouses.update', 'inventory.receive', 'inventory.adjust', 'inventory.transfer', 'inventory.reserve', 'inventory.release', 'inventory.policy.update', 'devices.read', 'devices.manage',
  ])('registers the %s permission', (permission) => {
    expect(isPermission(permission)).toBe(true);
  });

  it('grants cross-branch inventory authority only to inventory managers', () => {
    const inventoryManager = SYSTEM_ROLES.find((role) => role.code === 'INVENTORY_MANAGER');
    const branchManager = SYSTEM_ROLES.find((role) => role.code === 'BRANCH_MANAGER');
    expect(inventoryManager?.permissions).toEqual(expect.arrayContaining(['inventory.transfer', 'devices.manage', 'branches.update']));
    expect(branchManager?.permissions).toEqual(expect.arrayContaining(['inventory.transfer', 'devices.read']));
    expect(branchManager?.permissions).not.toContain('devices.manage');
  });

  it('denies missing stock-mutation permission', () => {
    expect(() => requirePermission(actor(['inventory.read']), 'inventory.adjust')).toThrow(AuthorizationError);
  });

  it('allows the configured branch and rejects a different branch', () => {
    const scoped = actor(['inventory.read'], 'branch-a');
    expect(() => requireBranchAccess(scoped, 'branch-a')).not.toThrow();
    expect(() => requireBranchAccess(scoped, 'branch-b')).toThrow(AuthorizationError);
  });
});
