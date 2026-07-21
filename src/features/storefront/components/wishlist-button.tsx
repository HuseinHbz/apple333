'use client';

import { Heart } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { useGuestWishlist } from '@/features/storefront/hooks/use-guest-wishlist';

export function WishlistButton({
  productSlug,
  className,
  compact = false,
}: {
  productSlug: string;
  className?: string;
  compact?: boolean;
}) {
  const wishlist = useGuestWishlist();
  const isSaved = wishlist.has(productSlug);
  const label = isSaved ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها';

  return (
    <Button
      variant={isSaved ? 'primary' : 'secondary'}
      size={compact ? 'sm' : 'md'}
      className={cn(compact ? 'size-9 p-0' : '', className)}
      aria-label={label}
      aria-pressed={isSaved}
      disabled={!wishlist.hydrated}
      onClick={() => wishlist.toggle(productSlug)}
    >
      <Heart className={cn('size-4', isSaved ? 'fill-current' : '')} aria-hidden="true" />
      {compact ? <span className="sr-only">{label}</span> : label}
    </Button>
  );
}
