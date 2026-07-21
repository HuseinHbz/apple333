import { z } from 'zod';

import type { WishlistProductSlug } from '@/features/storefront/types/wishlist';

export const GUEST_WISHLIST_VERSION = 1;
export const GUEST_WISHLIST_MAX_ITEMS = 100;

/** Matches the public PIM product-slug contract without accepting path-like input. */
export const wishlistProductSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .min(2)
  .max(160)
  .transform((slug) => slug as WishlistProductSlug);

export const guestWishlistStorageSchema = z.object({
  version: z.literal(GUEST_WISHLIST_VERSION),
  slugs: z.array(wishlistProductSlugSchema).max(GUEST_WISHLIST_MAX_ITEMS),
}).strict();

export type GuestWishlistStoragePayload = z.output<typeof guestWishlistStorageSchema>;

export function parseWishlistProductSlug(value: unknown): WishlistProductSlug | null {
  const result = wishlistProductSlugSchema.safeParse(value);
  return result.success ? result.data : null;
}
