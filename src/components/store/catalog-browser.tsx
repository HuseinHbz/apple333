'use client';

import { useQuery } from '@tanstack/react-query';
import { Filter, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ProductGrid } from '@/components/store/product-grid';
import { StoreErrorState, StoreLoadingState } from '@/components/store/store-page-state';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { storefrontCatalogApiPath, type StorefrontCatalogSort } from '@/features/storefront/services/catalog-url';
import { createPublicPimCatalogSearchAdapter, createPublicPimCatalogSearchTransport } from '@/features/storefront/queries/public-pim-catalog-search';
import { storeApi } from '@/lib/store-api';

import type { PublicCategoryPageDto, PublicProductPageDto } from './store-types';

type Sort = StorefrontCatalogSort;

const storefrontSearch = createPublicPimCatalogSearchAdapter(createPublicPimCatalogSearchTransport());

type CatalogInitialData = Readonly<{
  categories: PublicCategoryPageDto;
  products: PublicProductPageDto;
  productsUrl: string;
  filters: Readonly<{
    query: string;
    brand: string;
    model: string;
    category: string;
    color: string;
    storage: string;
    minPriceRials: string;
    maxPriceRials: string;
    inStock: boolean;
    sort: Sort;
    page: number;
  }>;
}>;

export function CatalogBrowser({ initialCategory = '', initialData }: { initialCategory?: string; initialData?: CatalogInitialData }) {
  const [query, setQuery] = useState(initialData?.filters.query ?? '');
  const [brand, setBrand] = useState(initialData?.filters.brand ?? '');
  const [model, setModel] = useState(initialData?.filters.model ?? '');
  const [category, setCategory] = useState(initialData?.filters.category ?? initialCategory);
  const [color, setColor] = useState(initialData?.filters.color ?? '');
  const [storage, setStorage] = useState(initialData?.filters.storage ?? '');
  const [minPriceRials, setMinPriceRials] = useState(initialData?.filters.minPriceRials ?? '');
  const [maxPriceRials, setMaxPriceRials] = useState(initialData?.filters.maxPriceRials ?? '');
  const [inStock, setInStock] = useState(initialData?.filters.inStock ?? false);
  const [sort, setSort] = useState<Sort>(initialData?.filters.sort ?? 'featured');
  const [page, setPage] = useState(initialData?.filters.page ?? 1);

  const productsUrl = useMemo(() => storefrontCatalogApiPath({ query, brand, model, category, color, storage, minPriceRials, maxPriceRials, inStock, sort, page }), [brand, category, color, inStock, maxPriceRials, minPriceRials, model, page, query, sort, storage]);
  const categories = useQuery({
    queryKey: ['storefront-categories'],
    queryFn: () => storeApi<PublicCategoryPageDto>('/api/store/categories'),
    initialData: initialData?.categories,
  });
  const products = useQuery({
    queryKey: ['storefront-products', productsUrl],
    queryFn: async () => {
      if (!query.trim()) return storeApi<PublicProductPageDto>(productsUrl);
      const result = await storefrontSearch.search({
        query,
        brand: brand || undefined,
        model: model || undefined,
        category: category || undefined,
        color: color || undefined,
        storage: storage || undefined,
        minPriceRials: minPriceRials || undefined,
        maxPriceRials: maxPriceRials || undefined,
        inStock: inStock || undefined,
        sort,
        page,
        pageSize: 24,
      });
      return {
        items: result.items,
        page: result.page,
        pageSize: result.pageSize,
        total: result.primaryTotal,
        totalPages: result.primaryTotalPages,
      } satisfies PublicProductPageDto;
    },
    initialData: initialData?.productsUrl === productsUrl ? initialData.products : undefined,
  });
  useEffect(() => {
    const search = productsUrl.split('?')[1] ?? '';
    window.history.replaceState(window.history.state, '', `/products?${search}`);
  }, [productsUrl]);

  useEffect(() => {
    setPage(1);
  }, [brand, category, color, inStock, maxPriceRials, minPriceRials, model, query, sort, storage]);

  return (
    <main id="storefront-content" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-xs font-bold tracking-[0.18em] text-zinc-600">APPLE CATALOG</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">محصولات اپل</h1>
        <p className="mt-3 text-sm leading-7 text-zinc-600">مدل‌ها را بر اساس مشخصات و موجودی واقعی شعب بررسی کنید.</p>
      </div>

      <section aria-label="فیلتر محصولات" className="mt-8 rounded-3xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-4 lg:items-end">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-bold text-zinc-600"><Search className="size-4" aria-hidden="true" /> جست‌وجو</span>
            <Input data-testid="storefront-search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام مدل یا مشخصه" />
          </label>
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-bold text-zinc-600"><Filter className="size-4" aria-hidden="true" /> دسته‌بندی</span>
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">همه دسته‌ها</option>
              {categories.data?.items.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
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
        <div className="mt-3 grid gap-3 border-t border-zinc-100 pt-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-zinc-600">برند</span>
            <Input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Apple" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-zinc-600">مدل</span>
            <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="مثلاً iPhone 16 Pro" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-zinc-600">رنگ</span>
            <Input value={color} onChange={(event) => setColor(event.target.value)} placeholder="مثلاً مشکی" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-zinc-600">حافظه</span>
            <Input value={storage} onChange={(event) => setStorage(event.target.value)} placeholder="مثلاً 256GB" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-zinc-600">حداقل قیمت (ریال)</span>
            <Input inputMode="numeric" value={minPriceRials} onChange={(event) => setMinPriceRials(event.target.value)} placeholder="0" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-zinc-600">حداکثر قیمت (ریال)</span>
            <Input inputMode="numeric" value={maxPriceRials} onChange={(event) => setMaxPriceRials(event.target.value)} placeholder="بدون سقف" />
          </label>
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
            {products.data.totalPages > 1 ? (
              <nav className="mt-8 flex items-center justify-center gap-3" aria-label="صفحه‌بندی محصولات">
                <Button variant="secondary" disabled={products.data.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>صفحه قبل</Button>
                <span className="text-sm font-semibold text-zinc-600">صفحه {products.data.page} از {products.data.totalPages}</span>
                <Button variant="secondary" disabled={products.data.page >= products.data.totalPages} onClick={() => setPage((current) => Math.min(products.data?.totalPages ?? current, current + 1))}>صفحه بعد</Button>
              </nav>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
