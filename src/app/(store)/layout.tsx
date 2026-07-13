import type { ReactNode } from 'react';

import { StorefrontShell } from '@/components/store/storefront-shell';

export default function StoreLayout({ children }: { children: ReactNode }) {
  return <StorefrontShell>{children}</StorefrontShell>;
}
