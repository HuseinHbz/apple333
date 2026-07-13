import type { BadgeProps } from '@/components/ui/badge';

export type PimStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';

export function formatPimDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '—';
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatRials(value: string | null): string {
  if (value === null) return '—';
  try {
    return `${new Intl.NumberFormat('fa-IR').format(BigInt(value))} ریال`;
  } catch {
    return '—';
  }
}

export function productStatusLabel(status: PimStatus): string {
  const labels: Record<PimStatus, string> = {
    DRAFT: 'پیش‌نویس',
    REVIEW: 'در انتظار بررسی',
    PUBLISHED: 'منتشرشده',
    ARCHIVED: 'بایگانی‌شده',
  };
  return labels[status];
}

export function productStatusTone(status: PimStatus): BadgeProps['tone'] {
  const tones: Record<PimStatus, BadgeProps['tone']> = {
    DRAFT: 'neutral',
    REVIEW: 'warning',
    PUBLISHED: 'success',
    ARCHIVED: 'danger',
  };
  return tones[status];
}

export function activeStatusLabel(active: boolean): string {
  return active ? 'فعال' : 'غیرفعال';
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'PIM_MUTATION_FAILED';
}

export function slugFromName(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function codeFromText(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase('en-US')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
