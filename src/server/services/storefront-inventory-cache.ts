import 'server-only';

import { revalidateTag } from 'next/cache';

/**
 * Inventory mutations call this only after their transaction commits. The
 * public catalog keeps a short revalidation window as a secondary safeguard.
 */
export function revalidateStorefrontInventory(): void {
  revalidateTag('storefront:catalog');
  revalidateTag('storefront:products');
}
