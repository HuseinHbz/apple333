import Link from 'next/link';

const links = [
  { href: '/products', label: 'همه محصولات' },
  { href: '/compare', label: 'مقایسه محصولات' },
  { href: '/cart', label: 'سبد خرید' },
];

export function StorefrontFooter() {
  return (
    <footer className="mt-16 border-t border-zinc-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:px-8">
        <div>
          <p className="text-xs font-bold tracking-[0.24em] text-zinc-500">APPLE333</p>
          <p className="mt-3 max-w-lg text-sm leading-7 text-zinc-600">
            فروشگاه تخصصی محصولات اپل با مشاهده موجودی شعب، بررسی مدل‌ها و آماده‌سازی شفاف خرید.
          </p>
        </div>
        <nav aria-label="پیوندهای فروشگاه" className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-zinc-700">
          {links.map((link) => <Link key={link.href} href={link.href} className="transition hover:text-black">{link.label}</Link>)}
        </nav>
      </div>
      <div className="border-t border-zinc-100 px-4 py-4 text-center text-xs text-zinc-500">
        پیش‌فاکتور و پرداخت نهایی در فاز مدیریت سفارش و پرداخت فعال می‌شود.
      </div>
    </footer>
  );
}
