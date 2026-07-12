import type { PublicProductVariantDto } from '@/modules/catalog/types';

export function formatRials(value: string): string {
  try {
    return `${new Intl.NumberFormat('fa-IR').format(BigInt(value))} ریال`;
  } catch {
    return 'قیمت در حال به‌روزرسانی است';
  }
}

export function productVariantLabel(variant: PublicProductVariantDto): string {
  return [variant.title, variant.color, variant.storage].filter((value): value is string => Boolean(value)).join(' · ') || 'مدل پایه';
}
