import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export default function AdminNotFound() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <EmptyState icon={SearchX} title="صفحه مدیریتی پیدا نشد" description="آدرس را بررسی کنید یا به داشبورد برگردید." action={<Link className="inline-flex h-10 items-center rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800" href="/admin">بازگشت به داشبورد</Link>} />
    </div>
  );
}
