'use client';

import { create } from 'zustand';

import type { StorefrontCartDto } from '@/modules/catalog/types';

type StorefrontCartState = Readonly<{
  cart: StorefrontCartDto | null;
  setCart: (cart: StorefrontCartDto) => void;
  clearCart: () => void;
}>;

export const useStorefrontCart = create<StorefrontCartState>((set) => ({
  cart: null,
  setCart: (cart) => set({ cart }),
  clearCart: () => set({ cart: null }),
}));
