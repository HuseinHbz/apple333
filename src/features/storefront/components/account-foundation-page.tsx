import Link from 'next/link';
import { Heart, MapPin, SlidersHorizontal, UserRound } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const capabilities = [
  { icon: UserRound, title: 'پروفایل', description: 'هویت و اطلاعات تماس مشتری پس از راه‌اندازی احراز هویت مشتری نمایش داده می‌شود.' },
  { icon: MapPin, title: 'نشانی‌ها', description: 'مدیریت نشانی‌ها به فاز حساب مشتری و فرآیند سفارش وابسته است؛ هنوز داده‌ای ذخیره نمی‌شود.' },
  { icon: Heart, title: 'علاقه‌مندی‌ها', description: 'در این فاز علاقه‌مندی مهمان در مرورگر نگهداری می‌شود و برای همگام‌سازی حساب آماده است.' },
  { icon: SlidersHorizontal, title: 'ترجیحات', description: 'ترجیحات اطلاع‌رسانی و تجربهٔ خرید پس از فعال‌شدن حساب مشتری قابل مدیریت خواهد بود.' },
];

export function AccountFoundationPage() {
  return (
    <main id="storefront-content" className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-xs font-bold tracking-[0.18em] text-zinc-600">ACCOUNT FOUNDATION</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">حساب کاربری</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600">زیرساخت تجربهٔ حساب مشتری تعریف شده است؛ اما ورود فعلی فقط برای مدیریت سازمانی است و نباید به‌اشتباه به مشتریان نمایش داده شود.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {capabilities.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="rounded-3xl shadow-none">
            <CardHeader><Icon className="size-5 text-zinc-700" aria-hidden="true" /><CardTitle className="mt-3">{title}</CardTitle></CardHeader>
            <CardContent><p className="text-sm leading-7 text-zinc-600">{description}</p></CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-8 text-sm text-zinc-600">برای مشاهدهٔ فهرست مهمان می‌توانید به <Link href="/wishlist" className="font-bold underline underline-offset-4">علاقه‌مندی‌ها</Link> بروید.</p>
    </main>
  );
}
