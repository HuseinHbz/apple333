import { LoaderCircle, PackageOpen } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';

export function StoreLoadingState({ label = 'در حال دریافت اطلاعات فروشگاه…' }: { label?: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center gap-3 rounded-3xl border border-zinc-200 bg-white p-8 text-sm font-semibold text-zinc-500">
      <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function StoreErrorState({ message = 'دریافت اطلاعات فروشگاه با مشکل مواجه شد.' }: { message?: string }) {
  return <EmptyState title="فعلاً امکان نمایش این بخش نیست" description={message} icon={PackageOpen} />;
}
