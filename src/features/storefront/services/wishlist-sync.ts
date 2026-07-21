import type {
  AuthenticatedWishlistSyncPort,
  WishlistSyncPlan,
} from '@/features/storefront/types/wishlist';

/**
 * Design-only declaration for a later customer-account phase. This module
 * deliberately exposes no authenticated persistence implementation.
 */
export const guestWishlistSyncPlan: WishlistSyncPlan = Object.freeze({
  guestSource: 'local-storage',
  authenticatedPersistence: 'not-implemented',
  mergeStrategy: 'stable-union-by-canonical-slug',
});

/**
 * Future account code may receive an approved port through dependency
 * injection. Keeping this type-level boundary here prevents guest browser
 * persistence from being mistaken for authenticated customer storage.
 */
export type WishlistSyncDependencies = Readonly<{
  port: AuthenticatedWishlistSyncPort;
}>;
