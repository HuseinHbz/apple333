import { describe, expect, it } from 'vitest';

import { isExpectedPristinePublicObject } from '../../scripts/inspect-inventory-test-database.mjs';

describe('inventory test database inspector', () => {
  it('allows only PostgreSQL\'s default plpgsql extension in an otherwise pristine public schema', () => {
    expect(isExpectedPristinePublicObject({ kind: 'extension', name: 'plpgsql' })).toBe(true);
    expect(isExpectedPristinePublicObject({ kind: 'extension', name: 'pgcrypto' })).toBe(false);
    expect(isExpectedPristinePublicObject({ kind: 'relation:r', name: 'InventoryItem' })).toBe(false);
  });
});
