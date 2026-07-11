'use client';

import { Bell, Menu, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAdminNotificationSummary } from '@/modules/admin/api-client';
import type { AdminActorView } from '@/modules/admin/types';

interface AdminHeaderProps {
  actor: AdminActorView;
  onOpenNavigation: () => void;
}

function actorInitial(actor: AdminActorView): string {
  const label = actor.name?.trim() || actor.email?.trim() || 'مدیر';
  return label.slice(0, 1).toLocaleUpperCase('fa-IR');
}

export function AdminHeader({ actor, onOpenNavigation }: AdminHeaderProps) {
  const actorLabel = actor.name?.trim() || actor.email?.trim() || 'مدیر سیستم';
  const notificationSummary = useAdminNotificationSummary(actor.permissions.includes('notifications.read'));
  const pending = notificationSummary.data?.total ?? 0;

  return (
    <header className="sticky top-0 z-20 flex h-[4.25rem] items-center justify-between border-b border-zinc-200 bg-zinc-50/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Button aria-label="باز کردن ناوبری" className="lg:hidden" onClick={onOpenNavigation} size="sm" variant="secondary">
          <Menu aria-hidden="true" className="size-4" />
        </Button>
        <div className="hidden max-w-md items-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-400 shadow-sm sm:flex">
          <Search aria-hidden="true" className="ml-2 size-4 shrink-0" />
          <span>جست‌وجوی سراسری در نسخه‌های بعدی فعال می‌شود</span>
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button aria-label="اعلان‌ها" className="relative rounded-xl p-2.5 text-zinc-500 transition hover:bg-zinc-200/70 hover:text-zinc-900" type="button">
          <Bell aria-hidden="true" className="size-[1.125rem]" />
          {pending > 0 ? <span className="absolute left-1 top-1 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white">{pending > 99 ? '99+' : pending}</span> : null}
          <span className="sr-only">مرکز اعلان‌ها</span>
        </button>
        <div className="flex min-w-0 items-center gap-2 rounded-xl border border-zinc-200 bg-white py-1.5 pl-2 pr-1.5 shadow-sm">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-700">{actorInitial(actor)}</span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-xs font-semibold text-zinc-800">{actorLabel}</span>
            <span className="block truncate text-[11px] text-zinc-500">{actor.email ?? 'حساب مدیریت'}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
