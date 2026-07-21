'use client';

import { useQuery } from '@tanstack/react-query';
import { Heart, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useState } from 'react';

import type { StorefrontCartDto } from '@/modules/catalog/types';
import { useStorefrontCart } from '@/modules/cart/store';
import { useGuestWishlist } from '@/features/storefront/hooks/use-guest-wishlist';
import { storeApi } from '@/lib/store-api';

const navigation = [
  { href: '/', label: 'خانه' },
  { href: '/products', label: 'محصولات' },
  { href: '/compare', label: 'مقایسه' },
];

export function StorefrontHeader() {
  const cart = useStorefrontCart((state) => state.cart);
  const setCart = useStorefrontCart((state) => state.setCart);
  const wishlist = useGuestWishlist();
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const mobileNavigationId = useId();

  const cartQuery = useQuery({
    queryKey: ['storefront-cart'],
    queryFn: () => storeApi<StorefrontCartDto>('/api/store/cart'),
    staleTime: 20_000,
  });

  useEffect(() => {
    if (cartQuery.data) setCart(cartQuery.data);
  }, [cartQuery.data, setCart]);

  useEffect(() => {
    if (!isMobileNavigationOpen) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileNavigationOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMobileNavigationOpen]);

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
          <Link href="/wishlist" className="relative inline-flex size-10 items-center justify-center rounded-xl text-zinc-700 transition hover:bg-white hover:text-black" aria-label="علاقه‌مندی‌ها">
            <Heart className="size-5" aria-hidden="true" />
            {wishlist.hydrated && wishlist.count > 0 ? <span className="absolute -left-1 -top-1 grid min-w-5 place-items-center rounded-full bg-zinc-950 px-1 text-[10px] font-bold leading-5 text-white">{wishlist.count}</span> : null}
          </Link>
          <Link href="/account" className="inline-flex size-10 items-center justify-center rounded-xl text-zinc-700 transition hover:bg-white hover:text-black" aria-label="حساب کاربری">
            <UserRound className="size-5" aria-hidden="true" />
          </Link>
          <Link href="/cart" className="relative inline-flex size-10 items-center justify-center rounded-xl text-zinc-700 transition hover:bg-white hover:text-black" aria-label="سبد خرید">
            <ShoppingBag className="size-5" aria-hidden="true" />
            {cart && cart.itemCount > 0 ? <span className="absolute -left-1 -top-1 grid min-w-5 place-items-center rounded-full bg-zinc-950 px-1 text-[10px] font-bold leading-5 text-white">{cart.itemCount}</span> : null}
          </Link>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-xl text-zinc-700 transition hover:bg-white hover:text-black md:hidden"
            aria-label={isMobileNavigationOpen ? 'Close navigation' : 'Open navigation'}
            aria-controls={mobileNavigationId}
            aria-expanded={isMobileNavigationOpen}
            onClick={() => setIsMobileNavigationOpen((isOpen) => !isOpen)}
          >
            {isMobileNavigationOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>
      {isMobileNavigationOpen ? (
        <nav id={mobileNavigationId} className="border-t border-zinc-200 bg-[#f6f6f4] px-4 py-3 md:hidden" aria-label="Mobile navigation">
          <div className="mx-auto flex max-w-7xl flex-wrap gap-2">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-white hover:text-black"
                onClick={() => setIsMobileNavigationOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
