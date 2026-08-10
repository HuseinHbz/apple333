'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, MapPin, Scale, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { ProductGrid } from '@/components/store/product-grid';
import { StoreErrorState, StoreLoadingState } from '@/components/store/store-page-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { storeApi } from '@/lib/store-api';

import type { PublicCategoryPageDto, PublicProductPageDto } from './store-types';

export type StoreHomeInitialData = Readonly<{
  categories: PublicCategoryPageDto;
  featuredProducts: PublicProductPageDto;
  newProducts: PublicProductPageDto;
  saleProducts: PublicProductPageDto;
}>;

export function StoreHome({ initialData }: { initialData?: StoreHomeInitialData }) {
  const categories = useQuery({
    queryKey: ['storefront-categories'],
    queryFn: () => storeApi<PublicCategoryPageDto>('/api/store/categories'),
    initialData: initialData?.categories,
  });
  const featuredProducts = useQuery({
    queryKey: ['storefront-products', 'home', 'featured'],
    queryFn: () => storeApi<PublicProductPageDto>('/api/store/products?page=1&pageSize=8&collection=featured&sort=featured'),
    initialData: initialData?.featuredProducts,
  });
  const newProducts = useQuery({
    queryKey: ['storefront-products', 'home', 'new'],
    queryFn: () => storeApi<PublicProductPageDto>('/api/store/products?page=1&pageSize=4&collection=new&sort=newest'),
    initialData: initialData?.newProducts,
  });
  const saleProducts = useQuery({
    queryKey: ['storefront-products', 'home', 'sale'],
    queryFn: () => storeApi<PublicProductPageDto>('/api/store/products?page=1&pageSize=4&collection=sale&sort=featured'),
    initialData: initialData?.saleProducts,
  });

  return (
    <main id="storefront-content">
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pt-14">
        <div className="relative overflow-hidden rounded-[2rem] bg-zinc-950 px-6 py-12 text-white sm:px-10 sm:py-16 lg:px-16">
          <div className="absolute inset-y-0 left-0 hidden w-1/2 bg-[radial-gradient(circle_at_20%_40%,rgba(255,255,255,0.18),transparent_36%),radial-gradient(circle_at_80%_80%,rgba(99,102,241,0.5),transparent_38%)] lg:block" aria-hidden="true" />
          <div className="relative max-w-2xl">
            <Badge className="border-white/20 bg-white/10 text-white" tone="neutral">تجربه خرید حرفه‌ای محصولات اپل</Badge>
            <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-5xl">انتخاب دقیق‌تر، خرید مطمئن‌تر.</h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-zinc-300 sm:text-lg">
              محصولات را با مشخصات واقعی، موجودی شعب و گزینه‌های خرید شفاف بررسی کنید؛ بدون نمایش وعده‌های پرداخت یا موجودی غیرواقعی.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products"><Button size="lg" className="bg-white text-zinc-950 hover:bg-zinc-200">مشاهده محصولات <ArrowLeft className="size-4" aria-hidden="true" /></Button></Link>
              <Link href="/compare"><Button size="lg" variant="secondary" className="border-white/30 bg-transparent text-white hover:bg-white/10">مقایسه مدل‌ها <Scale className="size-4" aria-hidden="true" /></Button></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: MapPin, title: 'مشاهده موجودی شعب', description: 'موجودی قابل‌تحویل هر مدل پیش از تصمیم خرید.' },
            { icon: ShieldCheck, title: 'اطلاعات شفاف محصول', description: 'جزئیات مدل، حافظه، رنگ و مشخصات محصول.' },
            { icon: CheckCircle2, title: 'بررسی پیش از سفارش', description: 'سبد و پیش‌نمایش خرید تا ورود به فاز سفارش.' },
          ].map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-2xl border border-zinc-200 bg-white p-5">
              <Icon className="size-5 text-zinc-700" aria-hidden="true" />
              <h2 className="mt-4 text-sm font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-zinc-600">CATALOG</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">پیشنهادهای ویژه</h2>
          </div>
          <Link href="/products" className="text-sm font-bold text-zinc-700 underline-offset-4 hover:underline">مشاهده همه</Link>
        </div>
        <div className="mt-6">
          {featuredProducts.isLoading ? <StoreLoadingState label="در حال دریافت پیشنهادهای ویژه…" /> : null}
          {featuredProducts.isError ? <StoreErrorState message="پس از اتصال کاتالوگ و موجودی، پیشنهادهای ویژه در این بخش نمایش داده می‌شوند." /> : null}
          {featuredProducts.data && featuredProducts.data.items.length === 0 ? <StoreErrorState message="هنوز پیشنهاد ویژهٔ منتشرشده‌ای در کاتالوگ وجود ندارد." /> : null}
          {featuredProducts.data && featuredProducts.data.items.length > 0 ? <ProductGrid products={featuredProducts.data.items} /> : null}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.18em] text-zinc-600">NEW</p><h2 className="mt-2 text-2xl font-black tracking-tight">محصولات جدید</h2></div><Link href="/products?sort=newest" className="text-sm font-bold text-zinc-700 underline-offset-4 hover:underline">مشاهدهٔ همه</Link></div><div className="mt-6">{newProducts.isLoading ? <StoreLoadingState label="در حال دریافت محصولات جدید…" /> : null}{newProducts.isError ? <p className="text-sm text-zinc-500">محصولات جدید پس از انتشار در کاتالوگ نمایش داده می‌شوند.</p> : null}{newProducts.data && newProducts.data.items.length === 0 ? <p className="text-sm text-zinc-500">محصول جدیدی برای نمایش ثبت نشده است.</p> : null}{newProducts.data && newProducts.data.items.length > 0 ? <ProductGrid products={newProducts.data.items} /> : null}</div></div>
          <div><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.18em] text-zinc-600">OFFERS</p><h2 className="mt-2 text-2xl font-black tracking-tight">تخفیف‌ها</h2></div><Link href="/products" className="text-sm font-bold text-zinc-700 underline-offset-4 hover:underline">مشاهدهٔ همه</Link></div><div className="mt-6">{saleProducts.isLoading ? <StoreLoadingState label="در حال دریافت تخفیف‌ها…" /> : null}{saleProducts.isError ? <p className="text-sm text-zinc-500">تخفیف‌های تأییدشده پس از انتشار در این بخش نمایش داده می‌شوند.</p> : null}{saleProducts.data && saleProducts.data.items.length === 0 ? <p className="text-sm text-zinc-500">تخفیف فعال و تأییدشده‌ای برای نمایش وجود ندارد.</p> : null}{saleProducts.data && saleProducts.data.items.length > 0 ? <ProductGrid products={saleProducts.data.items} /> : null}</div></div>
        </div>
        <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6"><p className="text-xs font-bold tracking-[0.18em] text-zinc-500">BEST SELLERS</p><h2 className="mt-2 text-xl font-black">پرفروش‌ترین‌ها</h2><p className="mt-3 text-sm leading-7 text-zinc-600">این بخش پس از ثبت سفارش‌های قطعی و فعال‌شدن گزارش فروش نمایش داده می‌شود؛ تا آن زمان رتبه‌بندی ساختگی نشان نمی‌دهیم.</p></div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8">
          <p className="text-xs font-bold tracking-[0.18em] text-zinc-500">CATEGORIES</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">دسته‌بندی‌های اپل</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {categories.isLoading ? <p className="text-sm text-zinc-500">در حال دریافت دسته‌بندی‌ها…</p> : null}
            {categories.isError ? <p className="text-sm text-zinc-500">دسته‌بندی‌ها پس از تکمیل کاتالوگ نمایش داده می‌شوند.</p> : null}
            {categories.data?.items.map((category) => <Link key={category.id} href={`/products?category=${encodeURIComponent(category.slug)}`} className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold transition hover:border-zinc-950 hover:bg-zinc-950 hover:text-white">{category.name}</Link>)}
          </div>
        </div>
      </section>
    </main>
  );
}
