import type { ReactNode } from 'react';

import { StorefrontFooter } from '@/components/store/storefront-footer';
import { StorefrontHeader } from '@/components/store/storefront-header';

export function StorefrontShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f6f4] text-zinc-950">
      <a href="#storefront-content" className="sr-only fixed right-4 top-4 z-50 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-bold text-white focus:not-sr-only">
        رفتن به محتوای اصلی
      </a>
      <StorefrontHeader />
      {children}
      <StorefrontFooter />
    </div>
  );
}
