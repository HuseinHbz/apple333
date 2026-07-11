import type { InputHTMLAttributes } from 'react';
import { cn } from './cn';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400',
        className
      )}
      {...props}
    />
  );
}
