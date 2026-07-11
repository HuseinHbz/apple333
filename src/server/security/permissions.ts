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
  'inventory.read',
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

export function requireBranchAccess(actor: SessionActor, branchId?: string | null): void {
  if (actor.branchId && branchId && actor.branchId !== branchId) {
    throw new AuthorizationError();
  }
}
