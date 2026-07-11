import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/modules/auth/session', () => ({ requireAdminActor: vi.fn() }));
vi.mock('@/server/logging/logger', () => ({ log: vi.fn() }));

import { requireAdminActor } from '@/modules/auth/session';
import { withAdminRoute } from '@/server/admin/route';
import { AuthenticationError } from '@/server/errors/app-error';
import type { SessionActor } from '@/server/security/permissions';

const actor: SessionActor = {
  id: 'admin_1',
  isAdmin: true,
  roleCodes: ['ADMIN'],
  permissions: new Set(['users.read', 'users.update'])
};

describe('admin route security pipeline', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a safe 401 envelope for an unauthenticated request', async () => {
    vi.mocked(requireAdminActor).mockRejectedValue(new AuthenticationError());
    const route = withAdminRoute({ permission: 'users.read', handler: async () => ({ ok: true }) });

    const response = await route(new Request('http://localhost/api/admin/users'));
    const body = await response.json() as { success: boolean; error: { code: string } };

    expect(response.status).toBe(401);
    expect(body).toMatchObject({ success: false, error: { code: 'UNAUTHENTICATED' } });
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('rejects a mutation without a same-origin request', async () => {
    vi.mocked(requireAdminActor).mockResolvedValue(actor);
    const route = withAdminRoute({ permission: 'users.update', mutation: true, handler: async () => ({ ok: true }) });

    const response = await route(new Request('http://localhost/api/admin/users/u1', { method: 'PATCH' }));

    expect(response.status).toBe(403);
  });

  it('returns a request id and no-store response for an authorized request', async () => {
    vi.mocked(requireAdminActor).mockResolvedValue(actor);
    const route = withAdminRoute({ permission: 'users.read', handler: async () => ({ ok: true }) });

    const response = await route(new Request('http://localhost/api/admin/users', { headers: { 'x-request-id': 'request_1234' } }));
    const body = await response.json() as { success: boolean; data: { ok: boolean }; meta: { requestId: string } };

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('request_1234');
    expect(body).toEqual({ success: true, data: { ok: true }, meta: { requestId: 'request_1234' } });
  });
});
