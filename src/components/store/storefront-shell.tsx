import type { ReactNode } from 'react';

import { StorefrontFooter } from '@/components/store/storefront-footer';
import { StorefrontHeader } from '@/components/store/storefront-header';

export function StorefrontShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f6f4] text-zinc-950">
      <StorefrontHeader />
      {children}
      <StorefrontFooter />
    </div>
  );
}
