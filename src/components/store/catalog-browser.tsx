'use client';

import { useQuery } from '@tanstack/react-query';
import { Filter, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ProductGrid } from '@/components/store/product-grid';
import { StoreErrorState, StoreLoadingState } from '@/components/store/store-page-state';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { PublicCategoryDto } from '@/modules/catalog/types';
import { storeApi } from '@/lib/store-api';

import type { PublicProductPageDto } from './store-types';

type Sort = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'name';

function productsPath(query: string, category: string, inStock: boolean, sort: Sort): string {
  const search = new URLSearchParams({ page: '1', pageSize: '24', sort });
  if (query.trim()) search.set('query', query.trim());
  if (category) search.set('category', category);
  if (inStock) search.set('inStock', 'true');
  return `/api/store/products?${search.toString()}`;
}

export function CatalogBrowser({ initialCategory = '' }: { initialCategory?: string }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState<Sort>('featured');

  const productsUrl = useMemo(() => productsPath(query, category, inStock, sort), [category, inStock, query, sort]);
  const categories = useQuery({ queryKey: ['storefront-categories'], queryFn: () => storeApi<readonly PublicCategoryDto[]>('/api/store/categories') });
  const products = useQuery({ queryKey: ['storefront-products', productsUrl], queryFn: () => storeApi<PublicProductPageDto>(productsUrl) });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-xs font-bold tracking-[0.18em] text-zinc-500">APPLE CATALOG</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">محصولات اپل</h1>
        <p className="mt-3 text-sm leading-7 text-zinc-600">مدل‌ها را بر اساس مشخصات و موجودی واقعی شعب بررسی کنید.</p>
      </div>

      <section aria-label="فیلتر محصولات" className="mt-8 rounded-3xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px_auto] lg:items-end">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-bold text-zinc-600"><Search className="size-4" aria-hidden="true" /> جست‌وجو</span>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام مدل یا مشخصه" />
          </label>
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-bold text-zinc-600"><Filter className="size-4" aria-hidden="true" /> دسته‌بندی</span>
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">همه دسته‌ها</option>
              {categories.data?.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-bold text-zinc-600"><SlidersHorizontal className="size-4" aria-hidden="true" /> مرتب‌سازی</span>
            <Select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="featured">پیشنهادی</option>
              <option value="newest">جدیدترین</option>
              <option value="price-asc">ارزان‌ترین</option>
              <option value="price-desc">گران‌ترین</option>
              <option value="name">نام محصول</option>
            </Select>
          </label>
          <Button variant={inStock ? 'primary' : 'secondary'} onClick={() => setInStock((value) => !value)} className="h-10">{inStock ? 'فقط موجود' : 'همه موجودی‌ها'}</Button>
        </div>
      </section>

      <section className="mt-8" aria-live="polite">
        {products.isLoading ? <StoreLoadingState label="در حال جست‌وجوی کاتالوگ…" /> : null}
        {products.isError ? <StoreErrorState message="کاتالوگ هنوز آماده دریافت نیست یا اتصال داده برقرار نشده است." /> : null}
        {products.data && products.data.items.length === 0 ? <EmptyState title="محصولی پیدا نشد" description="فیلترها را تغییر دهید یا پس از انتشار محصولات، دوباره به کاتالوگ مراجعه کنید." /> : null}
        {products.data && products.data.items.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-zinc-500">{new Intl.NumberFormat('fa-IR').format(products.data.total)} محصول پیدا شد</p>
            <ProductGrid products={products.data.items} />
          </>
        ) : null}
      </section>
    </main>
  );
}
