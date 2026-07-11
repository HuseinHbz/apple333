'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { visibleAdminNavigation } from '@/modules/admin/navigation.config';
import { AdminIcon } from './admin-icon';

interface AdminSidebarProps {
  permissions: readonly string[];
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function AdminSidebar({ permissions, mobileOpen, onMobileClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const navigation = visibleAdminNavigation(new Set(permissions));

  return (
    <>
      {mobileOpen ? <button aria-label="بستن منوی مدیریت" className="fixed inset-0 z-30 bg-zinc-950/35 lg:hidden" onClick={onMobileClose} type="button" /> : null}
      <aside
        aria-label="ناوبری مدیریت"
        className={cn(
          'fixed inset-y-0 right-0 z-40 flex w-72 flex-col border-l border-zinc-200 bg-white shadow-xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none',
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex h-[4.25rem] items-center justify-between border-b border-zinc-100 px-5">
          <Link className="flex items-center gap-3" href="/admin" onClick={onMobileClose}>
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-zinc-950 text-sm font-bold text-white">۳۳۳</span>
            <span>
              <span className="block text-sm font-bold tracking-tight text-zinc-950">Apple333</span>
              <span className="block text-[11px] font-medium text-zinc-500">Enterprise Console</span>
            </span>
          </Link>
          <button aria-label="بستن منو" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 lg:hidden" onClick={onMobileClose} type="button">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {navigation.map((group) => (
            <section className="mb-6" key={group.id}>
              <h2 className="mb-2 px-3 text-[11px] font-bold tracking-[0.08em] text-zinc-400">{group.label}</h2>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = item.href === '/admin' ? pathname === '/admin' : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.id}>
                      <Link
                        className={cn(
                          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                          active ? 'bg-zinc-950 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
                        )}
                        href={item.href}
                        onClick={onMobileClose}
                      >
                        <AdminIcon className="size-[1.125rem]" name={item.icon} strokeWidth={1.9} />
                        <span className="min-w-0 flex-1">{item.label}</span>
                        {item.availability === 'planned' ? <span className={cn('rounded-md px-1.5 py-0.5 text-[10px]', active ? 'bg-white/15 text-white/80' : 'bg-zinc-200/70 text-zinc-500')}>به‌زودی</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {navigation.length === 0 ? (
            <p className="rounded-xl bg-zinc-50 px-3 py-4 text-xs leading-5 text-zinc-500">برای نقش شما هیچ مسیر مدیریتی مجاز نیست.</p>
          ) : null}
        </nav>
        <div className="border-t border-zinc-100 px-5 py-4 text-xs leading-5 text-zinc-500">
          <span className="block font-medium text-zinc-700">Apple333 Enterprise</span>
          <span>دسترسی‌ها در هر درخواست بررسی می‌شوند.</span>
        </div>
      </aside>
    </>
  );
}
