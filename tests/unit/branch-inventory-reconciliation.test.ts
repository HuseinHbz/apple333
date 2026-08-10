import { describe, expect, it } from 'vitest';

import {
  reconcileBranchInventory,
  type CanonicalBranchInventoryBalance,
  type LegacyBranchInventoryBalance,
} from '@/modules/inventory/branch-inventory-reconciliation';

const canonical = (overrides: Partial<CanonicalBranchInventoryBalance> = {}): CanonicalBranchInventoryBalance => ({
  branchId: 'branch-a',
  variantId: 'variant-a',
  onHand: 10,
  reserved: 2,
  updatedAt: '2026-07-21T10:00:00.000Z',
  skuIds: ['sku-a'],
  ...overrides,
});

const projection = (overrides: Partial<LegacyBranchInventoryBalance> = {}): LegacyBranchInventoryBalance => ({
  branchId: 'branch-a',
  variantId: 'variant-a',
  onHand: 10,
  reserved: 2,
  updatedAt: '2026-07-21T10:00:00.000Z',
  ...overrides,
});

describe('reconcileBranchInventory', () => {
  it('accepts an exact compatibility projection', () => {
    const result = reconcileBranchInventory([canonical()], [projection()]);

    expect(result).toMatchObject({ canonicalCount: 1, projectionCount: 1, isReconciled: true, drift: [] });
  });

  it('accepts a zero sellable projection when the physical source is non-sellable', () => {
    const result = reconcileBranchInventory(
      [canonical({ onHand: 0, reserved: 0, skuIds: ['sku-damaged-physical-source'] })],
      [projection({ onHand: 0, reserved: 0 })],
    );

    expect(result).toMatchObject({ canonicalCount: 1, projectionCount: 1, isReconciled: true, drift: [] });
  });

  it('detects quantity, reserved, and stale projection drift', () => {
    const result = reconcileBranchInventory(
      [canonical()],
      [projection({ onHand: 9, reserved: 1, updatedAt: '2026-07-21T09:59:59.000Z' })],
    );

    expect(result.isReconciled).toBe(false);
    expect(result.drift.map((entry) => entry.kind)).toEqual(['ON_HAND_DRIFT', 'RESERVED_DRIFT', 'STALE_PROJECTION']);
  });

  it('detects a missing compatibility row and exposes SKU-level context', () => {
    const result = reconcileBranchInventory([canonical({ skuIds: ['sku-a', 'sku-b'] })], []);

    expect(result.drift.map((entry) => entry.kind)).toEqual(['MISSING_PROJECTION', 'SKU_DRIFT']);
    expect(result.drift[1]?.detail).toContain('sku-a, sku-b');
  });

  it('detects missing canonical and duplicate projection records', () => {
    const duplicate = projection();
    const result = reconcileBranchInventory([], [duplicate, duplicate]);

    expect(result.drift.map((entry) => entry.kind)).toEqual(['DUPLICATE_PROJECTION', 'MISSING_CANONICAL']);
  });
});
