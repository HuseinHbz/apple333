'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { MapPin, PackageCheck, ShieldCheck, Truck, WalletCards } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { StoreErrorState, StoreLoadingState } from '@/components/store/store-page-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import type { StorefrontCartDto, StorefrontQuoteDto } from '@/modules/catalog/types';
import { useStorefrontCart } from '@/modules/cart/store';
import { StoreApiError, storeApi } from '@/lib/store-api';

import { formatRials } from './store-utils';

type Fulfillment = 'PICKUP' | 'DELIVERY';

export function CheckoutPage() {
  const setCart = useStorefrontCart((state) => state.setCart);
  const cart = useQuery({ queryKey: ['storefront-cart'], queryFn: () => storeApi<StorefrontCartDto>('/api/store/cart') });

  useEffect(() => {
    if (cart.data) setCart(cart.data);
  }, [cart.data, setCart]);

  if (cart.isLoading) return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><StoreLoadingState label="در حال آماده‌سازی پیش‌نمایش خرید…" /></main>;
  if (cart.isError) return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><StoreErrorState message="برای ادامه، ابتدا سرویس سبد خرید و کاتالوگ باید در دسترس باشد." /></main>;
  if (!cart.data || cart.data.items.length === 0) return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><EmptyState title="سبد خرید خالی است" description="پیش از بررسی تحویل، حداقل یک محصول به سبد اضافه کنید." action={<Link href="/products"><Button>مشاهده محصولات</Button></Link>} /></main>;

  return <CheckoutContents cart={cart.data} />;
}

function CheckoutContents({ cart }: { cart: StorefrontCartDto }) {
  const branches = useMemo(() => pickupBranchesForCart(cart), [cart]);
  const [fulfillment, setFulfillment] = useState<Fulfillment>('DELIVERY');
  const [pickupBranchId, setPickupBranchId] = useState('');
  const [wantsInsurance, setWantsInsurance] = useState(false);
  const quote = useMutation({
    mutationFn: () => {
      const payload = fulfillment === 'PICKUP'
        ? { fulfillment, pickupBranchId, wantsInsurance }
        : { fulfillment, wantsInsurance };
      return storeApi<StorefrontQuoteDto>('/api/store/checkout/quote', { method: 'POST', body: JSON.stringify(payload) });
    },
  });

  const pickupUnavailable = fulfillment === 'PICKUP' && (!pickupBranchId || branches.length === 0);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-xs font-bold tracking-[0.18em] text-zinc-500">CHECKOUT REVIEW</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">بررسی روش تحویل</h1>
        <p className="mt-3 text-sm leading-7 text-zinc-600">این صفحه پیش‌نمایش قابل‌اعتماد خرید است؛ ثبت سفارش و پرداخت در فاز ۴ انجام می‌شود.</p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section className="space-y-5">
          <Card className="rounded-3xl shadow-none">
            <CardHeader><CardTitle>نحوه دریافت</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setFulfillment('DELIVERY')} className={`rounded-2xl border p-4 text-right transition focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-300 ${fulfillment === 'DELIVERY' ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 hover:border-zinc-400'}`}><Truck className="size-5" aria-hidden="true" /><p className="mt-3 text-sm font-bold">ارسال به آدرس</p><p className={`mt-1 text-xs leading-5 ${fulfillment === 'DELIVERY' ? 'text-zinc-300' : 'text-zinc-500'}`}>هزینه و بازه ارسال در مرحله سفارش نهایی می‌شود.</p></button>
                <button type="button" onClick={() => setFulfillment('PICKUP')} className={`rounded-2xl border p-4 text-right transition focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-300 ${fulfillment === 'PICKUP' ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 hover:border-zinc-400'}`}><MapPin className="size-5" aria-hidden="true" /><p className="mt-3 text-sm font-bold">تحویل حضوری از شعبه</p><p className={`mt-1 text-xs leading-5 ${fulfillment === 'PICKUP' ? 'text-zinc-300' : 'text-zinc-500'}`}>فقط شعب دارای موجودی قابل‌تحویل را انتخاب کنید.</p></button>
              </div>
              {fulfillment === 'PICKUP' ? <div className="mt-5"><label className="block"><span className="mb-2 block text-sm font-bold">شعبه تحویل</span><Select value={pickupBranchId} onChange={(event) => setPickupBranchId(event.target.value)} disabled={branches.length === 0}><option value="">یک شعبه را انتخاب کنید</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.city ? ` — ${branch.city}` : ''}</option>)}</Select></label>{branches.length === 0 ? <p className="mt-2 text-xs leading-5 text-amber-700">در حال حاضر هیچ شعبه‌ای نمی‌تواند همهٔ اقلام این سبد را هم‌زمان تحویل دهد.</p> : null}</div> : null}
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-none">
            <CardHeader><CardTitle>خدمات تکمیلی</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 p-4"><input type="checkbox" checked={wantsInsurance} onChange={(event) => setWantsInsurance(event.target.checked)} className="mt-1 size-4 accent-zinc-950" /><span><span className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="size-4" aria-hidden="true" /> بیمه حمل</span><span className="mt-1 block text-xs leading-5 text-zinc-500">درخواست شما ثبت می‌شود؛ مبلغ آن با پیش‌فاکتور فاز ۴ محاسبه خواهد شد.</span></span></label>
              <div className="flex gap-3 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600"><WalletCards className="size-5 shrink-0 text-zinc-700" aria-hidden="true" /><p>کیف پول، خرید اقساطی و درگاه پرداخت در مرحله سفارش و پرداخت فعال می‌شوند و اکنون مبلغی از شما دریافت نمی‌شود.</p></div>
            </CardContent>
          </Card>

          {quote.isError ? <Alert tone="danger" title="پیش‌نمایش خرید آماده نشد">{quote.error instanceof StoreApiError ? quote.error.message : 'لطفاً دوباره تلاش کنید.'}</Alert> : null}
          {quote.data ? <QuoteResult quote={quote.data} /> : null}
        </section>
        <aside className="lg:sticky lg:top-20">
          <Card className="rounded-3xl shadow-none">
            <CardHeader><CardTitle>خلاصه پیش‌نمایش</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">{cart.items.map((item) => <li key={item.variantId} className="flex justify-between gap-3"><span className="min-w-0 truncate text-zinc-600">{item.productName} × {item.quantity}</span><span className="shrink-0 font-semibold">{formatRials(item.unitPriceRials)}</span></li>)}</ul>
              <div className="my-5 border-t border-dashed border-zinc-200" />
              <div className="flex justify-between font-black"><span>جمع اقلام</span><span>{formatRials(cart.subtotalRials)}</span></div>
              <Button size="lg" className="mt-6 w-full" disabled={quote.isPending || pickupUnavailable} onClick={() => quote.mutate()}><PackageCheck className="size-4" aria-hidden="true" />{quote.isPending ? 'در حال بررسی…' : 'دریافت پیش‌نمایش خرید'}</Button>
              {pickupUnavailable ? <p className="mt-3 text-xs leading-5 text-amber-700">برای تحویل حضوری، یک شعبه دارای موجودی را انتخاب کنید.</p> : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function pickupBranchesForCart(cart: StorefrontCartDto) {
  const firstItem = cart.items[0];
  if (!firstItem) return [];
  return firstItem.branches.filter((candidate) => candidate.available >= firstItem.quantity && cart.items.every((item) => item.branches.some(
    (branch) => branch.id === candidate.id && branch.available >= item.quantity,
  )));
}

function QuoteResult({ quote }: { quote: StorefrontQuoteDto }) {
  return (
    <Alert tone="success" title="پیش‌نمایش خرید آماده است">
      <div className="space-y-2">
        <p>روش دریافت: {quote.fulfillment === 'PICKUP' ? `تحویل از ${quote.pickupBranch?.name ?? 'شعبه انتخاب‌شده'}` : 'ارسال به آدرس'}</p>
        <p>جمع اقلام: {formatRials(quote.cart.subtotalRials)}</p>
        <p className="font-semibold">پرداخت و ثبت سفارش هنوز انجام نشده است. {quote.nextStep === 'PHASE_04_ORDER_AND_PAYMENT_REQUIRED' ? 'برای ادامه باید فاز مدیریت سفارش و پرداخت فعال شود.' : ''}</p>
      </div>
    </Alert>
  );
}
