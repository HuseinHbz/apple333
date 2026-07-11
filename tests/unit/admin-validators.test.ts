import { describe, expect, it } from 'vitest';

import { createMediaInput } from '@/modules/media/validators';
import { createNotificationInput } from '@/modules/notifications/validators';
import { createRoleInput } from '@/modules/roles/validators';
import { upsertSettingInput } from '@/modules/settings/validators';

describe('admin validators', () => {
  it('accepts a governed custom role and rejects unsafe codes', () => {
    expect(createRoleInput.parse({ code: 'RETURNS_MANAGER', name: 'Returns', permissionIds: [] }).code).toBe('RETURNS_MANAGER');
    expect(() => createRoleInput.parse({ code: 'returns-manager', name: 'Returns', permissionIds: [] })).toThrow();
  });

  it('rejects media storage traversal and oversized metadata fields', () => {
    expect(() => createMediaInput.parse({
      storageKey: '../escape.jpg', originalName: 'escape.jpg', contentType: 'image/jpeg', extension: 'jpg', bytes: 10, kind: 'IMAGE'
    })).toThrow();
  });

  it('validates versioned settings and future-ready notifications', () => {
    expect(upsertSettingInput.parse({ key: 'security.session-timeout', category: 'SECURITY', value: 1800 }).expectedVersion).toBeUndefined();
    expect(() => createNotificationInput.parse({ recipientId: 'invalid', category: '', title: '', body: '' })).toThrow();
  });
});
