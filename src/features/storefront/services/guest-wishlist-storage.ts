import {
  GUEST_WISHLIST_MAX_ITEMS,
  GUEST_WISHLIST_VERSION,
  guestWishlistStorageSchema,
  parseWishlistProductSlug,
} from '@/features/storefront/schemas/wishlist';
import type {
  GuestWishlistSnapshot,
  WishlistProductSlug,
} from '@/features/storefront/types/wishlist';

export const GUEST_WISHLIST_STORAGE_KEY = 'apple333:storefront:guest-wishlist:v1';

export type WishlistStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const EMPTY_GUEST_WISHLIST: GuestWishlistSnapshot = Object.freeze({
  slugs: Object.freeze([]) as readonly WishlistProductSlug[],
  count: 0,
});

export function emptyGuestWishlist(): GuestWishlistSnapshot {
  return EMPTY_GUEST_WISHLIST;
}

export function createGuestWishlistSnapshot(values: readonly unknown[]): GuestWishlistSnapshot {
  const slugs: WishlistProductSlug[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const slug = parseWishlistProductSlug(value);
    if (slug === null || seen.has(slug)) continue;

    seen.add(slug);
    slugs.push(slug);

    if (slugs.length === GUEST_WISHLIST_MAX_ITEMS) break;
  }

  return Object.freeze({
    slugs: Object.freeze(slugs) as readonly WishlistProductSlug[],
    count: slugs.length,
  });
}

export function browserWishlistStorage(): WishlistStorage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    // Browsers can disable Storage (for example, in a privacy-restricted iframe).
    return null;
  }
}

export function readGuestWishlist(storage: WishlistStorage | null | undefined): GuestWishlistSnapshot {
  if (storage === null || storage === undefined) return emptyGuestWishlist();

  try {
    const serialized = storage.getItem(GUEST_WISHLIST_STORAGE_KEY);
    if (serialized === null) return emptyGuestWishlist();

    const parsed: unknown = JSON.parse(serialized);
    const payload = guestWishlistStorageSchema.safeParse(parsed);

    return payload.success ? createGuestWishlistSnapshot(payload.data.slugs) : emptyGuestWishlist();
  } catch {
    return emptyGuestWishlist();
  }
}

/**
 * Persist a sanitized, versioned payload. Storage failures intentionally leave
 * the caller's in-memory state usable; no data outside the wishlist key is touched.
 */
export function writeGuestWishlist(
  storage: WishlistStorage | null | undefined,
  values: readonly unknown[],
): GuestWishlistSnapshot {
  const snapshot = createGuestWishlistSnapshot(values);
  if (storage === null || storage === undefined) return snapshot;

  try {
    if (snapshot.count === 0) {
      storage.removeItem(GUEST_WISHLIST_STORAGE_KEY);
    } else {
      storage.setItem(GUEST_WISHLIST_STORAGE_KEY, JSON.stringify({
        version: GUEST_WISHLIST_VERSION,
        slugs: snapshot.slugs,
      }));
    }
  } catch {
    // Keep the sanitized in-memory snapshot when browser storage is unavailable.
  }

  return snapshot;
}

export function mergeGuestWishlistSlugs(
  primary: readonly unknown[],
  secondary: readonly unknown[],
): GuestWishlistSnapshot {
  return createGuestWishlistSnapshot([...primary, ...secondary]);
}
