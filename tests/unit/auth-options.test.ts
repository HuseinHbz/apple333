import { describe, expect, it, vi } from 'vitest';

vi.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: vi.fn(() => ({})),
}));

vi.mock('@/server/db/prisma', () => ({ prisma: {} }));

import { authOptions } from '@/auth';

describe('authentication options', () => {
  it('uses JWT sessions so the Credentials provider can establish an admin session', () => {
    expect(authOptions.session?.strategy).toBe('jwt');
  });

  it('maps the JWT subject to the application user id in the public session', async () => {
    const callback = authOptions.callbacks?.session;
    expect(callback).toBeDefined();

    const session = { user: { id: '', name: null, email: null, image: null }, expires: '2026-07-22T00:00:00.000Z' };
    const result = await callback!({ session, token: { sub: 'user-e2e-123' } } as never);

    expect((result.user as { id?: string } | undefined)?.id).toBe('user-e2e-123');
  });
});
