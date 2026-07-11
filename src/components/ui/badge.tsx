import type { HTMLAttributes } from 'react';
import { cn } from './cn';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border-zinc-200 bg-zinc-100 text-zinc-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700'
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5',
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
