import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireActor: vi.fn(),
  ownProfile: vi.fn(),
}));

vi.mock('@/modules/auth/session', () => ({ requireActor: mocks.requireActor }));
vi.mock('@/server/services/user-service', () => ({ ownProfile: mocks.ownProfile }));

import { GET } from '@/app/api/users/me/route';

describe('current-user route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActor.mockResolvedValue({ id: 'user_123' });
    mocks.ownProfile.mockResolvedValue({
      id: 'user_123',
      name: 'Test User',
      email: 'test@example.com',
      mobile: '09000000000',
      status: 'ACTIVE',
    });
  });

  it('does not allow an authenticated profile response to be stored by a shared cache', async () => {
    const response = await GET(new Request('http://localhost/api/users/me'));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('private, no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: 'user_123', email: 'test@example.com' },
    });
  });

  it('does not cache an authentication failure either', async () => {
    mocks.requireActor.mockRejectedValue(new Error('unauthenticated'));

    const response = await GET(new Request('http://localhost/api/users/me'));

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toContain('private, no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
  });
});
