import { describe, expect, it } from 'vitest';

import { adminUserListQuery, auditLogListQuery } from '@/modules/admin/validators';

describe('admin list query validation', () => {
  it('normalizes an enterprise user search and status filter', () => {
    expect(adminUserListQuery.parse({ page: '2', pageSize: '25', query: '  ali  ', status: 'ACTIVE' })).toEqual({
      page: 2,
      pageSize: 25,
      query: 'ali',
      status: 'ACTIVE',
    });
  });

  it('rejects an unsupported user status instead of widening the query', () => {
    expect(() => adminUserListQuery.parse({ status: 'ALL' })).toThrow();
  });

  it('accepts bounded audit date ranges and rejects an inverted range', () => {
    expect(auditLogListQuery.parse({
      action: 'admin.role',
      createdFrom: '2026-07-01T00:00:00.000Z',
      createdTo: '2026-07-11T23:59:59.999Z',
    }).action).toBe('admin.role');
    expect(() => auditLogListQuery.parse({
      createdFrom: '2026-07-12T00:00:00.000Z',
      createdTo: '2026-07-11T23:59:59.999Z',
    })).toThrow();
  });
});
