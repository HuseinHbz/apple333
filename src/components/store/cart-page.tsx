'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, ShieldCheck, ShoppingBag, Ticket, Trash2, WalletCards } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';

import { StoreErrorState, StoreLoadingState } from '@/components/store/store-page-state';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type { StorefrontCartDto } from '@/modules/catalog/types';
import { useStorefrontCart } from '@/modules/cart/store';
import { StoreApiError, storeApi } from '@/lib/store-api';

import { formatRials } from './store-utils';

export function CartPage() {
  const setCart = useStorefrontCart((state) => state.setCart);
  const cartQuery = useQuery({ queryKey: ['storefront-cart'], queryFn: () => storeApi<StorefrontCartDto>('/api/store/cart') });

  useEffect(() => {
    if (cartQuery.data) setCart(cartQuery.data);
  }, [cartQuery.data, setCart]);

  if (cartQuery.isLoading) return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><StoreLoadingState label="در حال دریافت سبد خرید…" /></main>;
  if (cartQuery.isError) return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><StoreErrorState message="سبد خرید پس از آماده‌سازی سرویس کاتالوگ و موجودی قابل استفاده است." /></main>;
  if (!cartQuery.data) return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><StoreErrorState /></main>;

  return <CartContents cart={cartQuery.data} />;
}

function CartContents({ cart }: { cart: StorefrontCartDto }) {
  const setCart = useStorefrontCart((state) => state.setCart);
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: ({ variantId, quantity }: { variantId: string; quantity: number }) => quantity === 0
      ? storeApi<StorefrontCartDto>(`/api/store/cart/items/${encodeURIComponent(variantId)}`, { method: 'DELETE' })
      : storeApi<StorefrontCartDto>(`/api/store/cart/items/${encodeURIComponent(variantId)}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
    onSuccess: (nextCart) => {
      setCart(nextCart);
      void queryClient.invalidateQueries({ queryKey: ['storefront-cart'] });
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-xs font-bold tracking-[0.18em] text-zinc-500">SHOPPING BAG</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">سبد خرید</h1>
        <p className="mt-3 text-sm leading-7 text-zinc-600">موجودی و قیمت نهایی در مرحله بررسی سفارش دوباره اعتبارسنجی می‌شود.</p>
      </div>

      {cart.items.length === 0 ? (
        <div className="mt-8"><EmptyState title="سبد شما خالی است" description="برای بررسی قیمت و موجودی، محصول موردنظرتان را از کاتالوگ به سبد اضافه کنید." icon={ShoppingBag} action={<Link href="/products"><Button>مشاهده محصولات</Button></Link>} /></div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <section className="space-y-3" aria-label="اقلام سبد خرید">
            {cart.items.map((item) => (
              <Card key={item.variantId} className="overflow-hidden rounded-3xl shadow-none">
                <CardContent className="flex gap-4 p-4 sm:p-5">
                  <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 sm:size-28">
                    {item.heroMediaUrl ? <Image src={item.heroMediaUrl} alt={item.productName} fill sizes="112px" className="object-cover" unoptimized /> : <div className="grid h-full place-items-center p-2 text-center text-xs text-zinc-400">تصویر محصول</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><Link href={`/products/${encodeURIComponent(item.productSlug)}`} className="font-bold transition hover:underline">{item.productName}</Link>{item.variantLabel ? <p className="mt-1 text-xs text-zinc-500">{item.variantLabel}</p> : null}</div>
                      <Badge tone={item.availability === 'IN_STOCK' ? 'success' : 'neutral'}>{item.availability === 'IN_STOCK' ? 'موجود' : 'ناموجود'}</Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-black">{formatRials(item.unitPriceRials)}</p>
                      <div className="flex items-center gap-1 rounded-xl border border-zinc-200 p-1">
                        <Button size="sm" variant="ghost" aria-label="کاهش تعداد" disabled={update.isPending || item.quantity <= 1} onClick={() => update.mutate({ variantId: item.variantId, quantity: item.quantity - 1 })}><Minus className="size-3.5" aria-hidden="true" /></Button>
                        <span className="min-w-8 text-center text-sm font-bold">{item.quantity}</span>
                        <Button size="sm" variant="ghost" aria-label="افزایش تعداد" disabled={update.isPending || item.quantity >= 10} onClick={() => update.mutate({ variantId: item.variantId, quantity: item.quantity + 1 })}><Plus className="size-3.5" aria-hidden="true" /></Button>
                        <Button size="sm" variant="ghost" aria-label="حذف از سبد" disabled={update.isPending} onClick={() => update.mutate({ variantId: item.variantId, quantity: 0 })}><Trash2 className="size-3.5 text-red-600" aria-hidden="true" /></Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {update.isError ? <Alert tone="danger" title="ویرایش سبد انجام نشد">{update.error instanceof StoreApiError ? update.error.message : 'لطفاً دوباره تلاش کنید.'}</Alert> : null}
          </section>
          <aside className="space-y-4 lg:sticky lg:top-20">
            <Card className="rounded-3xl shadow-none">
              <CardHeader><CardTitle>خلاصه خرید</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-zinc-600"><span>جمع اقلام ({cart.itemCount})</span><span>{formatRials(cart.subtotalRials)}</span></div>
                <div className="my-4 border-t border-dashed border-zinc-200" />
                <div className="flex items-center justify-between font-black"><span>جمع فعلی</span><span>{formatRials(cart.subtotalRials)}</span></div>
                <Link href="/checkout" className="mt-5 block"><Button size="lg" className="w-full">بررسی شیوه تحویل</Button></Link>
              </CardContent>
            </Card>
            <Card className="rounded-3xl shadow-none">
              <CardContent className="space-y-4 p-5">
                <div className="flex gap-3"><Ticket className="size-5 text-zinc-600" aria-hidden="true" /><div><p className="text-sm font-bold">کد تخفیف و کارت هدیه</p><p className="mt-1 text-xs leading-5 text-zinc-500">موتور تخفیف و کارت هدیه در فاز بازاریابی و مالی اضافه می‌شود.</p></div></div>
                <div className="flex gap-3"><WalletCards className="size-5 text-zinc-600" aria-hidden="true" /><div><p className="text-sm font-bold">کیف پول</p><p className="mt-1 text-xs leading-5 text-zinc-500">اعتبار کیف پول هنوز در این مرحله قابل استفاده نیست.</p></div></div>
                <div className="flex gap-3"><ShieldCheck className="size-5 text-zinc-600" aria-hidden="true" /><div><p className="text-sm font-bold">بیمه حمل</p><p className="mt-1 text-xs leading-5 text-zinc-500">هزینه بیمه در پیش‌فاکتور فاز مدیریت سفارش محاسبه می‌شود.</p></div></div>
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </main>
  );
}
