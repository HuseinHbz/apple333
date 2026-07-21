'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { parseWishlistProductSlug } from '@/features/storefront/schemas/wishlist';
import {
  GUEST_WISHLIST_STORAGE_KEY,
  browserWishlistStorage,
  emptyGuestWishlist,
  readGuestWishlist,
  writeGuestWishlist,
} from '@/features/storefront/services/guest-wishlist-storage';
import type {
  GuestWishlistSnapshot,
  GuestWishlistState,
  WishlistMutationResult,
  WishlistProductSlug,
} from '@/features/storefront/types/wishlist';

function result(
  changed: boolean,
  snapshot: GuestWishlistSnapshot,
  reason?: 'invalid-slug',
): WishlistMutationResult {
  return reason === undefined ? { changed, snapshot } : { changed, snapshot, reason };
}

export function useGuestWishlist(): GuestWishlistState {
  const [snapshot, setSnapshot] = useState<GuestWishlistSnapshot>(emptyGuestWishlist);
  const snapshotRef = useRef<GuestWishlistSnapshot>(snapshot);
  const [hydrated, setHydrated] = useState(false);

  const replaceSnapshot = useCallback((next: GuestWishlistSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
    return next;
  }, []);

  const commit = useCallback((nextSlugs: readonly WishlistProductSlug[]) => {
    const next = writeGuestWishlist(browserWishlistStorage(), nextSlugs);
    return replaceSnapshot(next);
  }, [replaceSnapshot]);

  useEffect(() => {
    replaceSnapshot(readGuestWishlist(browserWishlistStorage()));
    setHydrated(true);
  }, [replaceSnapshot]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== GUEST_WISHLIST_STORAGE_KEY) return;
      replaceSnapshot(readGuestWishlist(browserWishlistStorage()));
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [replaceSnapshot]);

  const has = useCallback((value: unknown) => {
    const slug = parseWishlistProductSlug(value);
    return slug !== null && snapshot.slugs.includes(slug);
  }, [snapshot.slugs]);

  const add = useCallback((value: unknown) => {
    const slug = parseWishlistProductSlug(value);
    const current = snapshotRef.current;
    if (slug === null) return result(false, current, 'invalid-slug');
    if (current.slugs.includes(slug)) return result(false, current);

    return result(true, commit([...current.slugs, slug]));
  }, [commit]);

  const remove = useCallback((value: unknown) => {
    const slug = parseWishlistProductSlug(value);
    const current = snapshotRef.current;
    if (slug === null) return result(false, current, 'invalid-slug');
    if (!current.slugs.includes(slug)) return result(false, current);

    return result(true, commit(current.slugs.filter((entry) => entry !== slug)));
  }, [commit]);

  const toggle = useCallback((value: unknown) => {
    const slug = parseWishlistProductSlug(value);
    const current = snapshotRef.current;
    if (slug === null) return result(false, current, 'invalid-slug');

    return current.slugs.includes(slug)
      ? result(true, commit(current.slugs.filter((entry) => entry !== slug)))
      : result(true, commit([...current.slugs, slug]));
  }, [commit]);

  const clear = useCallback(() => {
    const current = snapshotRef.current;
    return result(current.count > 0, commit([]));
  }, [commit]);

  return { hydrated, slugs: snapshot.slugs, count: snapshot.count, has, add, remove, toggle, clear };
}
