import { describe, expect, it } from 'vitest';

import {
  GUEST_WISHLIST_STORAGE_KEY,
  createGuestWishlistSnapshot,
  mergeGuestWishlistSlugs,
  readGuestWishlist,
  writeGuestWishlist,
} from '@/features/storefront/services/guest-wishlist-storage';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('guest wishlist storage', () => {
  it('normalizes, de-duplicates, and bounds untrusted product slugs', () => {
    const snapshot = createGuestWishlistSnapshot([
      ' iPhone-16-Pro ',
      'iphone-16-pro',
      '../unsafe',
      'airpods-pro-2',
    ]);

    expect(snapshot.slugs).toEqual(['iphone-16-pro', 'airpods-pro-2']);
    expect(snapshot.count).toBe(2);
  });

  it('persists only the versioned sanitized payload and removes its own empty key', () => {
    const storage = createMemoryStorage();

    const saved = writeGuestWishlist(storage, ['iPhone-16-Pro', '../unsafe']);
    expect(saved.slugs).toEqual(['iphone-16-pro']);
    expect(JSON.parse(storage.getItem(GUEST_WISHLIST_STORAGE_KEY) ?? '{}')).toEqual({
      version: 1,
      slugs: ['iphone-16-pro'],
    });

    writeGuestWishlist(storage, []);
    expect(storage.getItem(GUEST_WISHLIST_STORAGE_KEY)).toBeNull();
  });

  it('treats malformed or tampered browser storage as an empty wishlist', () => {
    const malformedJson = createMemoryStorage({ [GUEST_WISHLIST_STORAGE_KEY]: '{not-json' });
    const invalidPayload = createMemoryStorage({
      [GUEST_WISHLIST_STORAGE_KEY]: JSON.stringify({ version: 1, slugs: ['../unsafe'] }),
    });

    expect(readGuestWishlist(malformedJson)).toMatchObject({ count: 0, slugs: [] });
    expect(readGuestWishlist(invalidPayload)).toMatchObject({ count: 0, slugs: [] });
    expect(readGuestWishlist(null)).toMatchObject({ count: 0, slugs: [] });
  });

  it('uses stable canonical union semantics for a future authenticated merge', () => {
    expect(mergeGuestWishlistSlugs(
      ['iphone-16-pro', 'airpods-pro-2'],
      ['IPHONE-16-PRO', 'macbook-air-m4'],
    ).slugs).toEqual(['iphone-16-pro', 'airpods-pro-2', 'macbook-air-m4']);
  });
});
