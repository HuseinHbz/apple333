import { describe, expect, it } from 'vitest';

import { AuthorizationError } from '@/server/errors/app-error';
import { requirePermission, type SessionActor } from '@/server/security/permissions';

const actor: SessionActor = {
  id: 'u1',
  isAdmin: true,
  roleCodes: [],
  permissions: new Set()
};

describe('permission guard', () => {
  it('rejects a missing permission', () => {
    expect(() => requirePermission(actor, 'users.read')).toThrow(AuthorizationError);
  });
});
