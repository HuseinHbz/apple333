import { describe, expect, it } from 'vitest';

import { AuthorizationError } from '@/server/errors/app-error';
import {
  canAccessAdminRoute,
  isPermission,
  requireAllPermissions,
  requireAnyPermission,
  requireBranchAccess,
  type SessionActor
} from '@/server/security/permissions';

function actor(overrides: Partial<SessionActor> = {}): SessionActor {
  return {
    id: 'admin_1',
    isAdmin: true,
    roleCodes: ['ADMIN'],
    permissions: new Set(['users.read', 'roles.read']),
    ...overrides
  };
}

describe('enterprise permissions', () => {
  it('accepts only known resource.action permissions', () => {
    expect(isPermission('users.read')).toBe(true);
    expect(isPermission('users.export')).toBe(false);
  });

  it('enforces any/all permission semantics', () => {
    expect(() => requireAnyPermission(actor(), ['users.read', 'settings.update'])).not.toThrow();
    expect(() => requireAllPermissions(actor(), ['users.read', 'roles.read'])).not.toThrow();
    expect(() => requireAllPermissions(actor(), ['users.read', 'settings.update'])).toThrow(AuthorizationError);
  });

  it('enforces branch scope and server-side UI access', () => {
    const branchActor = actor({ branchId: 'branch-a' });
    expect(() => requireBranchAccess(branchActor, 'branch-b')).toThrow(AuthorizationError);
    expect(canAccessAdminRoute(branchActor, 'users.read')).toBe(true);
    expect(canAccessAdminRoute(actor({ isAdmin: false }), 'users.read')).toBe(false);
  });
});
