import { describe, expect, it } from 'vitest';

import { ProtectedSystemRoleError } from '@/server/admin/errors';
import { AuthorizationError } from '@/server/errors/app-error';
import { assertPermissionDelegation, assertRoleIsMutable } from '@/server/services/role-service';

describe('role service safety rules', () => {
  it('rejects mutation of a critical system role', () => {
    expect(() => assertRoleIsMutable(true)).toThrow(ProtectedSystemRoleError);
  });

  it('permits mutation of a custom role', () => {
    expect(() => assertRoleIsMutable(false)).not.toThrow();
  });

  it('prevents a role editor from delegating permissions it does not hold', () => {
    expect(() => assertPermissionDelegation(['users.read'], new Set(['users.read']))).not.toThrow();
    expect(() => assertPermissionDelegation(['settings.update'], new Set(['users.read']))).toThrow(AuthorizationError);
  });
});
