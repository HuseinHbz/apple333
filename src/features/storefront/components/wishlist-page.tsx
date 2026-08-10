'use client';

import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';

import { ProductGrid } from '@/components/store/product-grid';
import { StoreErrorState, StoreLoadingState } from '@/components/store/store-page-state';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useGuestWishlist } from '@/features/storefront/hooks/use-guest-wishlist';
import { storeApi } from '@/lib/store-api';
import type { PublicProductCardDto, PublicProductDto } from '@/modules/catalog/types';

function asCard(product: PublicProductDto): PublicProductCardDto {
  const {
    id,
    slug,
    name,
    brand,
    summary,
    category,
    heroMediaUrl,
    startingPriceRials,
    compareAtPriceRials,
    availability,
    isNew,
    isOnSale,
  } = product;
  return { id, slug, name, brand, summary, category, heroMediaUrl, startingPriceRials, compareAtPriceRials, availability, isNew, isOnSale };
}

export function WishlistPage() {
  const wishlist = useGuestWishlist();
  const products = useQuery({
    queryKey: ['storefront-wishlist-products', wishlist.slugs],
    enabled: wishlist.hydrated && wishlist.slugs.length > 0,
    queryFn: async () => Promise.all(
      wishlist.slugs.map(async (slug) => {
        try {
          return asCard(await storeApi<PublicProductDto>(`/api/store/products/${encodeURIComponent(slug)}`));
        } catch {
          return null;
        }
      }),
    ).then((items) => items.flatMap((item) => item ? [item] : [])),
  });

  return (
    <main id="storefront-content" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-zinc-600">WISHLIST</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">علاقه‌مندی‌ها</h1>
          <p className="mt-3 text-sm leading-7 text-zinc-600">این فهرست فقط در مرورگر فعلی شما نگهداری می‌شود و هنوز با حساب کاربری همگام‌سازی نمی‌شود.</p>
        </div>
        {wishlist.count > 0 ? <Button variant="secondary" onClick={() => wishlist.clear()}>پاک‌کردن فهرست</Button> : null}
      </div>

      {!wishlist.hydrated ? <StoreLoadingState label="در حال بازیابی علاقه‌مندی‌ها…" /> : null}
      {wishlist.hydrated && wishlist.count === 0 ? <EmptyState title="هنوز محصولی ذخیره نشده است" description="از صفحهٔ محصول یا کارت محصول، آن را به علاقه‌مندی‌ها اضافه کنید." icon={Heart} /> : null}
      {wishlist.hydrated && wishlist.count > 0 && products.isLoading ? <StoreLoadingState label="در حال دریافت اطلاعات محصولات ذخیره‌شده…" /> : null}
      {wishlist.hydrated && wishlist.count > 0 && products.isError ? <StoreErrorState message="برخی اطلاعات علاقه‌مندی‌ها در دسترس نیست. دوباره تلاش کنید." /> : null}
      {products.data && products.data.length > 0 ? <div className="mt-8"><ProductGrid products={products.data} /></div> : null}
      {wishlist.hydrated && wishlist.count > 0 && products.data?.length === 0 && !products.isLoading ? <EmptyState title="محصول منتشرشده‌ای در فهرست باقی نمانده است" description="محصولات حذف‌شده یا منتشرنشده به‌صورت خودکار نمایش داده نمی‌شوند." icon={Heart} /> : null}
    </main>
  );
}
