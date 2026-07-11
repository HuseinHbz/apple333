import type { SelectHTMLAttributes } from 'react';
import { cn } from './cn';

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-50',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
