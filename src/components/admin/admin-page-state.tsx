'use client';

import { CircleAlert, LoaderCircle, ServerOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminDataState } from '@/modules/admin/types';

interface AdminPageStateProps<T> {
  state: AdminDataState<T>;
  emptyTitle: string;
  emptyDescription: string;
  children: (data: T) => ReactNode;
}

export function AdminPageState<T>({ state, emptyTitle, emptyDescription, children }: AdminPageStateProps<T>) {
  if (state.kind === 'ready') return <>{children(state.data)}</>;

  if (state.kind === 'loading') {
    return (
      <div className="space-y-3" aria-label="در حال بارگذاری">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state.kind === 'empty') {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  if (state.kind === 'error') {
    return <EmptyState icon={CircleAlert} title="دریافت اطلاعات با خطا مواجه شد" description={state.message} />;
  }

  return (
    <EmptyState
      icon={ServerOff}
      title="اتصال داده هنوز فعال نشده است"
      description={state.reason ?? 'این نما آمادهٔ دریافت دادهٔ واقعی از سرویس مدیریت است؛ هیچ دادهٔ نمایشی یا عدد ساختگی نشان داده نمی‌شود.'}
    />
  );
}
