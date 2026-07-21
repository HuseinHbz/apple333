import type { InventoryAvailability } from './types';

/** The public storefront exposes availability bands, never device identifiers. */
export const LIMITED_AVAILABILITY_MAX = 2;

export function toInventoryAvailability(availableQuantity: number): InventoryAvailability {
  if (availableQuantity <= 0) return 'UNAVAILABLE';
  if (availableQuantity <= LIMITED_AVAILABILITY_MAX) return 'LIMITED';
  return 'AVAILABLE';
}
