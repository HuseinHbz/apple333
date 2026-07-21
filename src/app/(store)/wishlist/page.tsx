import type { Metadata } from 'next';

import { WishlistPage } from '@/features/storefront/components/wishlist-page';
import { storefrontUrl } from '@/features/storefront/services/metadata';

export const metadata: Metadata = {
  title: 'علاقه‌مندی‌ها',
  alternates: { canonical: storefrontUrl('/wishlist') },
  robots: { index: false, follow: true },
};

export default function WishlistRoute() {
  return <WishlistPage />;
}
