'use client';

import { useQuery } from '@tanstack/react-query';
import { Menu, Search, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import type { StorefrontCartDto } from '@/modules/catalog/types';
import { useStorefrontCart } from '@/modules/cart/store';
import { storeApi } from '@/lib/store-api';

const navigation = [
  { href: '/', label: 'خانه' },
  { href: '/products', label: 'محصولات' },
  { href: '/compare', label: 'مقایسه' },
];

export function StorefrontHeader() {
  const cart = useStorefrontCart((state) => state.cart);
  const setCart = useStorefrontCart((state) => state.setCart);

  const cartQuery = useQuery({
    queryKey: ['storefront-cart'],
    queryFn: () => storeApi<StorefrontCartDto>('/api/store/cart'),
    staleTime: 20_000,
  });

  useEffect(() => {
    if (cartQuery.data) setCart(cartQuery.data);
  }, [cartQuery.data, setCart]);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/90 bg-[#f6f6f4]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0 text-sm font-black tracking-[0.16em] text-zinc-950" aria-label="Apple333، خانه">APPLE333</Link>
        <nav className="hidden items-center gap-6 md:flex" aria-label="ناوبری اصلی">
          {navigation.map((item) => <Link key={item.href} href={item.href} className="text-sm font-semibold text-zinc-600 transition hover:text-zinc-950">{item.label}</Link>)}
        </nav>
        <div className="flex items-center gap-1">
          <Link href="/products" className="inline-flex size-10 items-center justify-center rounded-xl text-zinc-700 transition hover:bg-white hover:text-black" aria-label="جست‌وجوی محصولات">
            <Search className="size-5" aria-hidden="true" />
          </Link>
          <Link href="/cart" className="relative inline-flex size-10 items-center justify-center rounded-xl text-zinc-700 transition hover:bg-white hover:text-black" aria-label="سبد خرید">
            <ShoppingBag className="size-5" aria-hidden="true" />
            {cart && cart.itemCount > 0 ? <span className="absolute -left-1 -top-1 grid min-w-5 place-items-center rounded-full bg-zinc-950 px-1 text-[10px] font-bold leading-5 text-white">{cart.itemCount}</span> : null}
          </Link>
          <Link href="/products" className="inline-flex size-10 items-center justify-center rounded-xl text-zinc-700 md:hidden" aria-label="منوی محصولات">
            <Menu className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}
