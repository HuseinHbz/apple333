import Image from 'next/image';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { PublicProductCardDto } from '@/modules/catalog/types';

import { formatRials } from './store-utils';

export function StoreProductCard({ product }: { product: PublicProductCardDto }) {
  const productHref = `/products/${encodeURIComponent(product.slug)}`;

  return (
    <Card className="group overflow-hidden rounded-3xl border-zinc-200 bg-white shadow-none transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-zinc-200/70">
      <Link href={productHref} className="block focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-300">
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-zinc-100 via-white to-zinc-200">
          {product.heroMediaUrl ? (
            <Image src={product.heroMediaUrl} alt={product.name} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" unoptimized />
          ) : (
            <div className="flex h-full items-center justify-center text-center text-sm font-semibold text-zinc-400">تصویر محصول پس از ثبت در کاتالوگ نمایش داده می‌شود</div>
          )}
          <div className="absolute right-3 top-3 flex flex-wrap gap-2">
            {product.isNew ? <Badge tone="info">جدید</Badge> : null}
            {product.isOnSale ? <Badge tone="warning">پیشنهاد ویژه</Badge> : null}
          </div>
        </div>
        <div className="p-5">
          <p className="text-xs font-semibold text-zinc-500">{product.category?.name ?? product.brand}</p>
          <h3 className="mt-1 line-clamp-2 min-h-12 text-base font-bold leading-6 text-zinc-950">{product.name}</h3>
          {product.summary ? <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-zinc-500">{product.summary}</p> : <div className="min-h-10" />}
          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-zinc-500">از</p>
              <p className="mt-1 text-sm font-black text-zinc-950">{formatRials(product.startingPriceRials)}</p>
              {product.compareAtPriceRials ? <p className="mt-1 text-xs text-zinc-400 line-through">{formatRials(product.compareAtPriceRials)}</p> : null}
            </div>
            <Badge tone={product.availability === 'IN_STOCK' ? 'success' : 'neutral'}>{product.availability === 'IN_STOCK' ? 'موجود' : 'ناموجود'}</Badge>
          </div>
        </div>
      </Link>
    </Card>
  );
}
