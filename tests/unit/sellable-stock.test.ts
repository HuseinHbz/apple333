import { describe, expect, it } from 'vitest';

import {
  SELLABLE_LOCATION_TYPES,
  isSellableInventoryLocation,
  isSellableLocationType,
  type SellableInventoryLocation,
} from '@/modules/inventory/sellable-stock';

function location(overrides: Partial<SellableInventoryLocation> = {}): SellableInventoryLocation {
  return {
    type: 'STORAGE',
    status: 'ACTIVE',
    warehouse: {
      status: 'ACTIVE',
      branch: { status: 'ACTIVE', isActive: true },
    },
    ...overrides,
  };
}

describe('sellable inventory location contract', () => {
  it('allows only STORAGE and PICKUP locations to contribute to sellable stock', () => {
    expect(SELLABLE_LOCATION_TYPES).toEqual(['STORAGE', 'PICKUP']);
    expect(isSellableLocationType('STORAGE')).toBe(true);
    expect(isSellableLocationType('PICKUP')).toBe(true);
    expect(isSellableLocationType('RECEIVING')).toBe(false);
    expect(isSellableLocationType('QUARANTINE')).toBe(false);
    expect(isSellableLocationType('DAMAGED')).toBe(false);
  });

  it('requires the location, warehouse, and branch to be commercially active', () => {
    expect(isSellableInventoryLocation(location())).toBe(true);
    expect(isSellableInventoryLocation(location({ type: 'PICKUP' }))).toBe(true);
    expect(isSellableInventoryLocation(location({ type: 'DAMAGED' }))).toBe(false);
    expect(isSellableInventoryLocation(location({ status: 'DISABLED' }))).toBe(false);
    expect(isSellableInventoryLocation(location({
      warehouse: { status: 'DISABLED', branch: { status: 'ACTIVE', isActive: true } },
    }))).toBe(false);
    expect(isSellableInventoryLocation(location({
      warehouse: { status: 'ACTIVE', branch: { status: 'DISABLED', isActive: true } },
    }))).toBe(false);
    expect(isSellableInventoryLocation(location({
      warehouse: { status: 'ACTIVE', branch: { status: 'ACTIVE', isActive: false } },
    }))).toBe(false);
  });
});
