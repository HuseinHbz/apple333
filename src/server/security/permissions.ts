import { AuthorizationError } from '@/server/errors/app-error';

export const PERMISSIONS = [
  'dashboard.read',
  'users.read',
  'users.create',
  'users.update',
  'users.delete',
  'roles.read',
  'roles.create',
  'roles.update',
  'roles.delete',
  'permissions.read',
  'permissions.manage',
  'settings.read',
  'settings.update',
  'media.read',
  'media.create',
  'media.delete',
  'notifications.read',
  'notifications.update',
  'audit.read',
  'products.read',
  'products.create',
  'products.update',
  'products.delete',
  'products.publish',
  'categories.read',
  'categories.create',
  'categories.update',
  'categories.delete',
  'brands.read',
  'brands.create',
  'brands.update',
  'brands.delete',
  'attributes.read',
  'attributes.create',
  'attributes.update',
  'attributes.delete',
  'warranties.read',
  'warranties.create',
  'warranties.update',
  'warranties.delete',
  'product-imports.read',
  'product-imports.create',
  'product-imports.apply',
  'branches.read',
  'branches.create',
  'branches.update',
  'warehouses.read',
  'warehouses.create',
  'warehouses.update',
  'inventory.read',
  'inventory.receive',
  'inventory.adjust',
  'inventory.transfer',
  'inventory.reserve',
  'inventory.release',
  'inventory.policy.update',
  'devices.read',
  'devices.manage',
  'orders.read',
  'finance.read',
  'crm.read',
  'reports.read',
  'system.read'
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type SessionActor = {
  id: string;
  name?: string | null;
  email?: string | null;
  branchId?: string | null;
  roleCodes: readonly string[];
  permissions: ReadonlySet<Permission>;
  isAdmin: boolean;
};

const permissionSet = new Set<string>(PERMISSIONS);

/**
 * These roles are explicitly allowed to operate across branches. A user that
 * also carries a branch-scoped role remains global only when one of these
 * roles is present; this preserves explicit full-platform administration.
 */
export const INVENTORY_GLOBAL_ROLE_CODES = ['SUPER_ADMIN', 'ADMIN', 'INVENTORY_MANAGER'] as const;

/** Roles whose inventory authority is always bound to AdminUser.branchId. */
export const INVENTORY_BRANCH_SCOPED_ROLE_CODES = ['BRANCH_MANAGER', 'WAREHOUSE_STAFF'] as const;

export function isPermission(value: string): value is Permission {
  return permissionSet.has(value);
}

export function hasPermission(actor: SessionActor, permission: Permission): boolean {
  return actor.permissions.has(permission);
}

export function canAccessAdminRoute(actor: SessionActor, permission?: Permission): boolean {
  return actor.isAdmin && (!permission || hasPermission(actor, permission));
}

export function requirePermission(actor: SessionActor, permission: Permission): void {
  if (!hasPermission(actor, permission)) {
    throw new AuthorizationError();
  }
}

export function requireAnyPermission(actor: SessionActor, permissions: readonly Permission[]): void {
  if (!permissions.some((permission) => hasPermission(actor, permission))) {
    throw new AuthorizationError();
  }
}

export function requireAllPermissions(actor: SessionActor, permissions: readonly Permission[]): void {
  if (!permissions.every((permission) => hasPermission(actor, permission))) {
    throw new AuthorizationError();
  }
}

/**
 * Resolves the effective inventory branch scope once for every inventory
 * service path. Pure branch-scoped actors must be provisioned with a branch;
 * a missing AdminUser.branchId is an authorization failure, never global
 * scope.
 */
export function resolveInventoryBranchScope(actor: SessionActor): string | undefined {
  if (INVENTORY_GLOBAL_ROLE_CODES.some((roleCode) => actor.roleCodes.includes(roleCode))) {
    return undefined;
  }

  if (INVENTORY_BRANCH_SCOPED_ROLE_CODES.some((roleCode) => actor.roleCodes.includes(roleCode))) {
    if (!actor.branchId) {
      throw new AuthorizationError();
    }
    return actor.branchId;
  }

  return actor.branchId ?? undefined;
}

/** Use for inventory configuration that has no meaningful branch target. */
export function requireGlobalInventoryScope(actor: SessionActor): void {
  if (resolveInventoryBranchScope(actor) !== undefined) {
    throw new AuthorizationError();
  }
}

export function requireBranchAccess(actor: SessionActor, branchId?: string | null): void {
  const scopedBranchId = resolveInventoryBranchScope(actor);
  if (scopedBranchId && branchId && scopedBranchId !== branchId) {
    throw new AuthorizationError();
  }
}
