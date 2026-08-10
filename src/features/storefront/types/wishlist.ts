/**
 * The persisted guest wishlist contains only canonical product slugs. It is
 * intentionally separate from authenticated customer data until the account
 * module provides an approved persistence boundary.
 */
export type WishlistProductSlug = string & { readonly __brand: 'WishlistProductSlug' };

export type GuestWishlistSnapshot = Readonly<{
  slugs: readonly WishlistProductSlug[];
  count: number;
}>;

export type WishlistMutationResult = Readonly<{
  changed: boolean;
  snapshot: GuestWishlistSnapshot;
  reason?: 'invalid-slug';
}>;

export type GuestWishlistState = Readonly<{
  /** False during SSR and until browser storage has been read after mount. */
  hydrated: boolean;
  slugs: readonly WishlistProductSlug[];
  count: number;
  has: (slug: unknown) => boolean;
  add: (slug: unknown) => WishlistMutationResult;
  remove: (slug: unknown) => WishlistMutationResult;
  toggle: (slug: unknown) => WishlistMutationResult;
  clear: () => WishlistMutationResult;
}>;

/**
 * Contract for the future account module. No implementation is provided in
 * this phase and no authenticated wishlist data is written by the storefront.
 */
export interface AuthenticatedWishlistSyncPort {
  readForCustomer(input: Readonly<{ customerId: string }>): Promise<readonly WishlistProductSlug[]>;
  mergeGuestWishlist(input: Readonly<{
    customerId: string;
    guestSlugs: readonly WishlistProductSlug[];
  }>): Promise<readonly WishlistProductSlug[]>;
}

export type WishlistSyncPlan = Readonly<{
  guestSource: 'local-storage';
  authenticatedPersistence: 'not-implemented';
  mergeStrategy: 'stable-union-by-canonical-slug';
}>;
