import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useGuestWishlist } from '@/features/storefront/hooks/use-guest-wishlist';
import { GUEST_WISHLIST_STORAGE_KEY } from '@/features/storefront/services/guest-wishlist-storage';

describe('useGuestWishlist', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('hydrates after mount without reading browser storage during the initial render', async () => {
    window.localStorage.setItem(GUEST_WISHLIST_STORAGE_KEY, JSON.stringify({
      version: 1,
      slugs: ['iphone-16-pro'],
    }));

    const { result } = renderHook(() => useGuestWishlist());

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.slugs).toEqual(['iphone-16-pro']);
  });

  it('adds, removes, toggles, and refuses invalid slugs without corrupting persisted state', async () => {
    const { result } = renderHook(() => useGuestWishlist());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => {
      expect(result.current.add('IPhone-16-Pro').changed).toBe(true);
      expect(result.current.add('AirPods-Pro-2').changed).toBe(true);
      expect(result.current.add('../unsafe')).toMatchObject({ changed: false, reason: 'invalid-slug' });
    });
    expect(result.current.has('iphone-16-pro')).toBe(true);
    expect(result.current.count).toBe(2);

    act(() => {
      expect(result.current.toggle('iphone-16-pro').changed).toBe(true);
    });
    expect(result.current.slugs).toEqual(['airpods-pro-2']);

    act(() => {
      expect(result.current.remove('airpods-pro-2').changed).toBe(true);
    });
    expect(result.current.count).toBe(0);
    expect(window.localStorage.getItem(GUEST_WISHLIST_STORAGE_KEY)).toBeNull();
  });
});
