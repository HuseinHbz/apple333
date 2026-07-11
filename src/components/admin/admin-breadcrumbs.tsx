'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { findAdminNavigationItem } from '@/modules/admin/navigation.config';

interface AdminBreadcrumbsProps {
  pathname: string;
}

export function AdminBreadcrumbs({ pathname }: AdminBreadcrumbsProps) {
  const item = findAdminNavigationItem(pathname);
  if (!item || pathname === '/admin') {
    return <nav aria-label="مسیر صفحه" className="text-xs font-medium text-zinc-500">مدیریت</nav>;
  }

  return (
    <nav aria-label="مسیر صفحه" className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
      <Link className="transition hover:text-zinc-950" href="/admin">مدیریت</Link>
      <ChevronLeft className="size-3.5 text-zinc-400" aria-hidden="true" />
      <span className="text-zinc-700">{item.label}</span>
    </nav>
  );
}
