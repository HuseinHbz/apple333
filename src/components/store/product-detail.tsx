'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, HeartHandshake, Scale, ShoppingBag, Store, WalletCards } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ProductGallery } from '@/components/store/product-gallery';
import { ProductGrid } from '@/components/store/product-grid';
import { StoreErrorState, StoreLoadingState } from '@/components/store/store-page-state';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PublicProductDto, StorefrontCartDto } from '@/modules/catalog/types';
import { useStorefrontCart } from '@/modules/cart/store';
import { StoreApiError, storeApi } from '@/lib/store-api';

import { formatRials, productVariantLabel } from './store-utils';
import type { PublicProductPageDto } from './store-types';

export function ProductDetail({ slug }: { slug: string }) {
  const product = useQuery({
    queryKey: ['storefront-product', slug],
    queryFn: () => storeApi<PublicProductDto>(`/api/store/products/${encodeURIComponent(slug)}`),
  });

  if (product.isLoading) return <StoreLoadingState label="در حال دریافت اطلاعات محصول…" />;
  if (product.isError) return <StoreErrorState message="این محصول منتشر نشده، وجود ندارد یا سرویس کاتالوگ در دسترس نیست." />;
  if (!product.data) return <StoreErrorState />;

  return <ProductDetailContent product={product.data} />;
}

function ProductDetailContent({ product }: { product: PublicProductDto }) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(product.variants[0]?.id ?? null);
  const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId) ?? product.variants[0] ?? null;
  const setCart = useStorefrontCart((state) => state.setCart);
  const queryClient = useQueryClient();
  const addToCart = useMutation({
    mutationFn: (variantId: string) => storeApi<StorefrontCartDto>('/api/store/cart/items', { method: 'POST', body: JSON.stringify({ variantId, quantity: 1 }) }),
    onSuccess: (cart) => {
      setCart(cart);
      void queryClient.invalidateQueries({ queryKey: ['storefront-cart'] });
    },
  });
  const relatedProducts = useQuery({
    queryKey: ['storefront-related-products', product.slug, product.category?.slug],
    queryFn: () => storeApi<PublicProductPageDto>(`/api/store/products?category=${encodeURIComponent(product.category?.slug ?? '')}&page=1&pageSize=4&sort=featured`),
    enabled: Boolean(product.category?.slug),
  });
  const related = relatedProducts.data?.items.filter((item) => item.slug !== product.slug) ?? [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] lg:items-start">
        <ProductGallery product={product} />
        <section>
          <div className="flex flex-wrap gap-2">
            {product.category ? <Badge tone="neutral">{product.category.name}</Badge> : null}
            {product.isNew ? <Badge tone="info">جدید</Badge> : null}
            {product.isOnSale ? <Badge tone="warning">پیشنهاد ویژه</Badge> : null}
          </div>
          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">{product.name}</h1>
          {product.summary ? <p className="mt-4 text-base leading-8 text-zinc-600">{product.summary}</p> : null}

          <Card className="mt-6 rounded-3xl shadow-none">
            <CardContent className="p-5">
              <p className="text-xs font-bold text-zinc-500">انتخاب مدل</p>
              {product.variants.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {product.variants.map((variant) => (
                    <button key={variant.id} type="button" onClick={() => setSelectedVariantId(variant.id)} className={`rounded-2xl border p-3 text-right transition focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-300 ${selectedVariant?.id === variant.id ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white hover:border-zinc-400'}`}>
                      <span className="block text-sm font-bold">{productVariantLabel(variant)}</span>
                      <span className={`mt-1 block text-xs ${selectedVariant?.id === variant.id ? 'text-zinc-300' : 'text-zinc-500'}`}>{formatRials(variant.priceRials)}</span>
                    </button>
                  ))}
                </div>
              ) : <p className="mt-3 text-sm text-zinc-500">برای این محصول هنوز مدل قابل‌فروشی منتشر نشده است.</p>}

              {selectedVariant ? (
                <>
                  <div className="mt-5 flex items-end justify-between gap-4 border-t border-zinc-100 pt-5">
                    <div>
                      <p className="text-xs text-zinc-500">قیمت این مدل</p>
                      <p className="mt-1 text-xl font-black">{formatRials(selectedVariant.priceRials)}</p>
                      {selectedVariant.compareAtPriceRials ? <p className="mt-1 text-xs text-zinc-400 line-through">{formatRials(selectedVariant.compareAtPriceRials)}</p> : null}
                    </div>
                    <Badge tone={selectedVariant.availability === 'IN_STOCK' ? 'success' : 'neutral'}>{selectedVariant.availability === 'IN_STOCK' ? 'موجود در شعب منتخب' : 'فعلاً ناموجود'}</Badge>
                  </div>
                  <Button size="lg" className="mt-5 w-full" disabled={selectedVariant.availability !== 'IN_STOCK' || addToCart.isPending} onClick={() => addToCart.mutate(selectedVariant.id)}>
                    <ShoppingBag className="size-4" aria-hidden="true" />
                    {addToCart.isPending ? 'در حال افزودن…' : 'افزودن به سبد'}
                  </Button>
                  {addToCart.isSuccess ? <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="size-4" aria-hidden="true" /> محصول به سبد افزوده شد.</p> : null}
                  {addToCart.isError ? <Alert className="mt-4" tone="danger" title="افزودن به سبد انجام نشد">{addToCart.error instanceof StoreApiError ? addToCart.error.message : 'لطفاً دوباره تلاش کنید.'}</Alert> : null}
                </>
              ) : null}
            </CardContent>
          </Card>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link href={`/compare?slugs=${encodeURIComponent(product.slug)}`} className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm font-bold transition hover:border-zinc-950"><Scale className="size-5 text-zinc-600" aria-hidden="true" /> مقایسه این مدل</Link>
            <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm font-bold text-zinc-500"><HeartHandshake className="size-5" aria-hidden="true" /> طرح تعویض در فاز بعدی فعال می‌شود</div>
          </div>
        </section>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.75fr]">
        <Card className="rounded-3xl shadow-none">
          <CardHeader><CardTitle>مشخصات و توضیحات</CardTitle></CardHeader>
          <CardContent>
            {product.description ? <p className="whitespace-pre-line text-sm leading-8 text-zinc-600">{product.description}</p> : <p className="text-sm text-zinc-500">توضیح تکمیلی برای این محصول ثبت نشده است.</p>}
            {product.specifications.length > 0 ? <dl className="mt-6 divide-y divide-zinc-100 border-y border-zinc-100">{product.specifications.map((item) => <div key={item.key} className="grid grid-cols-2 gap-4 py-3 text-sm"><dt className="font-semibold text-zinc-500">{item.key}</dt><dd className="font-bold text-zinc-900">{item.value}</dd></div>)}</dl> : null}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card className="rounded-3xl shadow-none">
            <CardHeader><CardTitle>موجودی شعب</CardTitle></CardHeader>
            <CardContent>
              {selectedVariant?.branches.length ? <ul className="space-y-3">{selectedVariant.branches.map((branch) => <li key={branch.id} className="flex items-start justify-between gap-3 text-sm"><span className="flex gap-2 font-semibold"><Store className="mt-0.5 size-4 text-zinc-500" aria-hidden="true" />{branch.name}{branch.city ? `، ${branch.city}` : ''}</span><span className="text-zinc-500">{branch.available > 0 ? `${branch.available} قابل‌تحویل` : 'ناموجود'}</span></li>)}</ul> : <p className="text-sm leading-6 text-zinc-500">موجودی قابل‌تحویل برای مدل انتخاب‌شده ثبت نشده است.</p>}
            </CardContent>
          </Card>
          <Alert tone="info" title="خرید اقساطی و پرداخت">محاسبه اقساط، پرداخت و صدور سفارش در فاز ۴ مدیریت سفارش و پرداخت فعال می‌شود. در این مرحله فقط سبد و پیش‌نمایش خرید آماده است.</Alert>
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600"><WalletCards className="size-5 text-zinc-700" aria-hidden="true" /> کیف پول و کارت هدیه پس از راه‌اندازی سرویس‌های مالی قابل استفاده خواهند بود.</div>
        </div>
      </div>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl shadow-none">
          <CardHeader><CardTitle>پرسش‌های متداول</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <details className="rounded-2xl border border-zinc-200 p-4"><summary className="cursor-pointer text-sm font-bold">آیا افزودن به سبد، کالا را رزرو می‌کند؟</summary><p className="mt-3 text-sm leading-7 text-zinc-600">خیر. موجودی هنگام دریافت پیش‌نمایش و دوباره هنگام ثبت سفارش در فاز مدیریت سفارش اعتبارسنجی می‌شود.</p></details>
            <details className="rounded-2xl border border-zinc-200 p-4"><summary className="cursor-pointer text-sm font-bold">آیا قیمت نهایی همین مبلغ است؟</summary><p className="mt-3 text-sm leading-7 text-zinc-600">قیمت از سرور خوانده می‌شود و در مرحلهٔ سفارش مجدداً اعتبارسنجی خواهد شد. هزینهٔ ارسال، بیمه و تخفیف در این صفحه اعمال نشده است.</p></details>
            <details className="rounded-2xl border border-zinc-200 p-4"><summary className="cursor-pointer text-sm font-bold">خرید اقساطی چگونه فعال می‌شود؟</summary><p className="mt-3 text-sm leading-7 text-zinc-600">محاسبه و ثبت مدارک اقساط پس از پیاده‌سازی فاز اقساط و مرحلهٔ سفارش فعال خواهد شد.</p></details>
          </CardContent>
        </Card>
        <Card className="rounded-3xl shadow-none">
          <CardHeader><CardTitle>نظر کاربران</CardTitle></CardHeader>
          <CardContent><p className="text-sm leading-7 text-zinc-600">سامانهٔ نظر و امتیازدهی هنوز به منبع دادهٔ تأییدشده متصل نشده است؛ برای جلوگیری از نمایش نظر ساختگی، در این نسخه نظری نمایش داده نمی‌شود.</p></CardContent>
        </Card>
      </section>

      {product.category ? <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.18em] text-zinc-500">RELATED</p><h2 className="mt-2 text-2xl font-black">محصولات مرتبط</h2></div><Link href={`/products?category=${encodeURIComponent(product.category.slug)}`} className="text-sm font-bold text-zinc-700 underline-offset-4 hover:underline">مشاهدهٔ همه</Link></div>
        <div className="mt-6">
          {relatedProducts.isLoading ? <StoreLoadingState label="در حال دریافت محصولات مرتبط…" /> : null}
          {relatedProducts.isError ? <p className="text-sm text-zinc-500">محصولات مرتبط در حال حاضر در دسترس نیستند.</p> : null}
          {related.length > 0 ? <ProductGrid products={related} /> : null}
        </div>
      </section> : null}
    </main>
  );
}
