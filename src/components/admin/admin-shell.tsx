'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { useAdminShellStore } from '@/modules/admin/store';
import type { AdminActorView } from '@/modules/admin/types';

import { AdminBreadcrumbs } from './admin-breadcrumbs';
import { AdminFooter } from './admin-footer';
import { AdminHeader } from './admin-header';
import { AdminSidebar } from './admin-sidebar';

interface AdminShellProps {
  actor: AdminActorView;
  children: ReactNode;
}

export function AdminShell({ actor, children }: AdminShellProps) {
  const pathname = usePathname();
  const mobileNavigationOpen = useAdminShellStore((state) => state.mobileNavigationOpen);
  const openMobileNavigation = useAdminShellStore((state) => state.openMobileNavigation);
  const closeMobileNavigation = useAdminShellStore((state) => state.closeMobileNavigation);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 lg:flex">
      <AdminSidebar mobileOpen={mobileNavigationOpen} onMobileClose={closeMobileNavigation} permissions={actor.permissions} />
      <div className="min-w-0 flex-1">
        <AdminHeader actor={actor} onOpenNavigation={openMobileNavigation} />
        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 sm:px-6 lg:px-8">
          <AdminBreadcrumbs pathname={pathname} />
        </div>
        <main>{children}</main>
        <AdminFooter />
      </div>
    </div>
  );
}
