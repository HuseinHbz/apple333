'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, Scale } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { StoreErrorState, StoreLoadingState } from '@/components/store/store-page-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type { PublicProductCardDto, PublicProductDto } from '@/modules/catalog/types';
import { storeApi } from '@/lib/store-api';

import { formatRials } from './store-utils';
import type { PublicProductComparisonDto, PublicProductPageDto } from './store-types';

function uniqueSlugs(slugs: readonly string[]): string[] {
  return [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))].slice(0, 4);
}

export function CompareWorkbench({
  initialSlugs,
  initialComparison,
}: {
  initialSlugs: readonly string[];
  initialComparison?: PublicProductComparisonDto;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(() => uniqueSlugs(initialSlugs));
  const catalog = useQuery({
    queryKey: ['storefront-products', 'compare-picker'],
    queryFn: () => storeApi<PublicProductPageDto>('/api/store/products?page=1&pageSize=24&sort=featured'),
  });
  const comparePath = selected.length >= 2 ? `/api/store/products/compare?slugs=${encodeURIComponent(selected.join(','))}` : null;
  const compared = useQuery({
    queryKey: ['storefront-compare', selected],
    queryFn: () => storeApi<PublicProductComparisonDto>(comparePath ?? '/api/store/products/compare'),
    enabled: comparePath !== null,
    initialData: selected.join(',') === uniqueSlugs(initialSlugs).join(',') ? initialComparison : undefined,
  });

  const specifications = useMemo(() => {
    const keys = new Set<string>();
    for (const product of compared.data?.items ?? []) for (const item of product.specifications) keys.add(item.key);
    return [...keys];
  }, [compared.data]);

  function toggle(slug: string) {
    setSelected((current) => current.includes(slug) ? current.filter((item) => item !== slug) : current.length >= 4 ? current : [...current, slug]);
  }

  function applyComparison() {
    if (selected.length < 2) return;
    router.replace(selected.length ? `/compare?slugs=${encodeURIComponent(selected.join(','))}` : '/compare');
  }

  return (
    <main id="storefront-content" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-xs font-bold tracking-[0.18em] text-zinc-600">COMPARE</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">مقایسه محصولات</h1>
        <p className="mt-3 text-sm leading-7 text-zinc-600">حداکثر چهار محصول را برای مقایسه قیمت، مدل‌های موجود و مشخصات انتخاب کنید.</p>
      </div>

      <section className="mt-8 rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6" aria-label="انتخاب محصولات برای مقایسه">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="font-bold">انتخاب محصول</h2><p className="mt-1 text-sm text-zinc-500">{selected.length} از ۴ محصول انتخاب شده است.</p></div>
          <Button onClick={applyComparison} disabled={selected.length < 2}><Scale className="size-4" aria-hidden="true" /> مقایسه انتخاب‌ها</Button>
        </div>
        {catalog.isLoading ? <p className="mt-5 text-sm text-zinc-500">در حال دریافت کاتالوگ…</p> : null}
        {catalog.isError ? <p className="mt-5 text-sm text-zinc-500">فهرست محصولات برای مقایسه فعلاً در دسترس نیست.</p> : null}
        {catalog.data ? <ComparePicker products={catalog.data.items} selected={selected} onToggle={toggle} /> : null}
      </section>

      <section className="mt-8" aria-live="polite">
        {selected.length === 1 ? <p className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">برای مشاهدهٔ جدول، یک محصول منتشرشدهٔ دیگر انتخاب کنید.</p> : null}
        {selected.length === 0 ? <EmptyState title="محصولی انتخاب نشده است" description="از کاتالوگ بالا یک تا چهار محصول را انتخاب کنید تا تفاوت آن‌ها را ببینید." icon={Scale} /> : null}
        {selected.length > 0 && compared.isLoading ? <StoreLoadingState label="در حال آماده‌سازی مقایسه…" /> : null}
        {selected.length > 0 && compared.isError ? <StoreErrorState message="مقایسه فقط برای محصولات منتشرشده و قابل مشاهده در کاتالوگ در دسترس است." /> : null}
        {compared.data && compared.data.items.length > 0 ? <ComparisonTable products={compared.data.items} specificationKeys={specifications} /> : null}
      </section>
    </main>
  );
}

function ComparePicker({ products, selected, onToggle }: { products: readonly PublicProductCardDto[]; selected: readonly string[]; onToggle: (slug: string) => void }) {
  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const active = selected.includes(product.slug);
        const disabled = !active && selected.length >= 4;
        return (
          <button key={product.id} type="button" onClick={() => onToggle(product.slug)} disabled={disabled} className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-right transition focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 hover:border-zinc-500'}`}>
            <span className="min-w-0"><span className="block truncate text-sm font-bold">{product.name}</span><span className={`mt-1 block text-xs ${active ? 'text-zinc-300' : 'text-zinc-500'}`}>{formatRials(product.startingPriceRials)}</span></span>
            <span className={`grid size-5 shrink-0 place-items-center rounded-full border ${active ? 'border-white bg-white text-zinc-950' : 'border-zinc-300 text-transparent'}`}><Check className="size-3" aria-hidden="true" /></span>
          </button>
        );
      })}
    </div>
  );
}

function ComparisonTable({ products, specificationKeys }: { products: readonly PublicProductDto[]; specificationKeys: readonly string[] }) {
  const valuesFor = (product: PublicProductDto, key: string) => product.specifications.find((item) => item.key === key)?.value ?? '—';
  return (
    <Card className="overflow-x-auto rounded-3xl shadow-none">
      <CardContent className="min-w-[720px] p-0">
        <table className="w-full border-collapse text-right text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="w-48 p-5 font-bold text-zinc-500">ویژگی</th>
              {products.map((product) => <th key={product.id} className="min-w-56 p-5 align-top"><p className="font-black text-zinc-950">{product.name}</p><p className="mt-2 text-xs font-medium text-zinc-500">از {formatRials(product.startingPriceRials)}</p><Badge className="mt-3" tone={product.availability === 'IN_STOCK' ? 'success' : 'neutral'}>{product.availability === 'IN_STOCK' ? 'موجود' : 'ناموجود'}</Badge></th>)}
            </tr>
          </thead>
          <tbody>
            <ComparisonRow label="مدل‌های قابل‌فروش" products={products} value={(product) => product.variants.length ? product.variants.map((variant) => variant.storage ?? variant.title ?? variant.sku).join('، ') : '—'} />
            <ComparisonRow label="قیمت شروع" products={products} value={(product) => formatRials(product.startingPriceRials)} />
            {specificationKeys.map((key) => <ComparisonRow key={key} label={key} products={products} value={(product) => valuesFor(product, key)} />)}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function ComparisonRow({ label, products, value }: { label: string; products: readonly PublicProductDto[]; value: (product: PublicProductDto) => string }) {
  return <tr className="border-b border-zinc-100 last:border-0"><th scope="row" className="bg-zinc-50/50 p-5 font-semibold text-zinc-600">{label}</th>{products.map((product) => <td key={product.id} className="p-5 leading-6 text-zinc-800">{value(product)}</td>)}</tr>;
}
