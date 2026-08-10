import { describe, expect, it } from 'vitest';

import { LIMITED_AVAILABILITY_MAX, toInventoryAvailability } from '@/modules/inventory/availability';
import { inventoryAvailability } from '@/server/services/inventory-service';

describe('inventory availability bands', () => {
  it.each([
    [-5, 'UNAVAILABLE'],
    [0, 'UNAVAILABLE'],
    [1, 'LIMITED'],
    [LIMITED_AVAILABILITY_MAX, 'LIMITED'],
    [LIMITED_AVAILABILITY_MAX + 1, 'AVAILABLE'],
    [99, 'AVAILABLE'],
  ] as const)('classifies %i available units as %s', (quantity, expected) => {
    expect(toInventoryAvailability(quantity)).toBe(expected);
  });

  it('keeps server inventory and storefront availability bands aligned', () => {
    for (const quantity of [0, 1, LIMITED_AVAILABILITY_MAX, LIMITED_AVAILABILITY_MAX + 1]) {
      expect(inventoryAvailability(quantity)).toBe(toInventoryAvailability(quantity));
    }
  });
});
