'use client';

import Image from 'next/image';
import { PlayCircle } from 'lucide-react';
import { useState } from 'react';

import type { PublicProductDto } from '@/modules/catalog/types';

export function ProductGallery({ product }: { product: PublicProductDto }) {
  const [activeId, setActiveId] = useState<string | null>(product.media[0]?.id ?? null);
  const active = product.media.find((media) => media.id === activeId) ?? product.media[0] ?? null;

  return (
    <section aria-label="تصاویر محصول">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[2rem] border border-zinc-200 bg-white">
        {active?.role === 'VIDEO' ? (
          <video controls preload="metadata" className="max-h-full max-w-full" aria-label={active.altText ?? `ویدئوی ${product.name}`}>
            <source src={active.url} />
            مرورگر شما از پخش ویدئو پشتیبانی نمی‌کند.
          </video>
        ) : active ? (
          <Image src={active.url} alt={active.altText ?? product.name} fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-contain p-6" priority />
        ) : (
          <p className="max-w-56 text-center text-sm leading-7 text-zinc-400">تصویر محصول پس از ثبت در کاتالوگ نمایش داده می‌شود.</p>
        )}
      </div>
      {product.media.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="تصاویر بیشتر">
          {product.media.map((media) => (
            <button key={media.id} type="button" onClick={() => setActiveId(media.id)} className={`relative size-16 shrink-0 overflow-hidden rounded-xl border transition focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-300 ${active?.id === media.id ? 'border-zinc-950' : 'border-zinc-200 hover:border-zinc-400'}`} aria-label={media.altText ?? `نمایش رسانه ${product.name}`}>
              {media.role === 'VIDEO' ? <PlayCircle className="m-auto size-5 text-zinc-700" aria-hidden="true" /> : <Image src={media.url} alt="" fill sizes="64px" className="object-cover" />}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
