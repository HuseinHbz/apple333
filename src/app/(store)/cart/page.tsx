import type { Metadata } from 'next';

import { CartPage } from '@/components/store/cart-page';
import { storefrontUrl } from '@/features/storefront/services/metadata';

export const metadata: Metadata = {
  title: 'سبد خرید',
  alternates: { canonical: storefrontUrl('/cart') },
  robots: { index: false, follow: true },
};

export default function CartRoutePage() {
  return <CartPage />;
}
