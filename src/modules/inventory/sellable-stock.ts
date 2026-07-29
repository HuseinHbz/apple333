import type { InventoryLocationType } from '@/modules/inventory/types';

/**
 * BranchInventory is a commercial projection, not a physical-stock ledger.
 * Only these location types can contribute to a branch's sellable balance.
 * Receiving, quarantine, and damaged locations remain physical inventory
 * evidence in InventoryItem but are intentionally excluded from storefront
 * availability and reservation capacity.
 */
export const SELLABLE_LOCATION_TYPES = ['STORAGE', 'PICKUP'] as const satisfies readonly InventoryLocationType[];

export type SellableInventoryLocation = Readonly<{
  type: InventoryLocationType;
  status: string;
  warehouse: Readonly<{
    status: string;
    branch: Readonly<{
      status: string;
      isActive: boolean;
    }>;
  }>;
}>;

export function isSellableLocationType(type: InventoryLocationType): boolean {
  return SELLABLE_LOCATION_TYPES.some((candidate) => candidate === type);
}

/**
 * This guard is deliberately stricter than a physical-inventory mutation.
 * Physical stock may be received, adjusted, or transferred through every
 * active location type; only active commercial locations are sellable.
 */
export function isSellableInventoryLocation(location: SellableInventoryLocation): boolean {
  return isSellableLocationType(location.type)
    && location.status === 'ACTIVE'
    && location.warehouse.status === 'ACTIVE'
    && location.warehouse.branch.status === 'ACTIVE'
    && location.warehouse.branch.isActive;
}
