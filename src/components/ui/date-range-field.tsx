import type { InputHTMLAttributes } from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from './cn';

export interface DateRangeFieldProps {
  from: InputHTMLAttributes<HTMLInputElement>;
  to: InputHTMLAttributes<HTMLInputElement>;
  className?: string;
}

export function DateRangeField({ from, to, className }: DateRangeFieldProps) {
  return (
    <fieldset className={cn('flex flex-wrap items-center gap-2 text-xs text-zinc-500', className)}>
      <legend className="sr-only">بازه تاریخ</legend>
      <CalendarDays className="size-4" aria-hidden="true" />
      <input className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 disabled:bg-zinc-50" type="date" {...from} />
      <span>تا</span>
      <input className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 disabled:bg-zinc-50" type="date" {...to} />
    </fieldset>
  );
}
