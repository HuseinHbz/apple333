import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import type { HTMLAttributes } from 'react';

import { cn } from './cn';

type ToastTone = 'info' | 'success' | 'danger';

const styles: Record<ToastTone, { className: string; Icon: typeof Info }> = {
  info: { className: 'border-sky-200 bg-sky-50 text-sky-900', Icon: Info },
  success: { className: 'border-emerald-200 bg-emerald-50 text-emerald-900', Icon: CircleCheck },
  danger: { className: 'border-red-200 bg-red-50 text-red-900', Icon: CircleAlert },
};

export function Toast({ className, tone = 'info', children, ...props }: HTMLAttributes<HTMLDivElement> & { tone?: ToastTone }) {
  const { className: toneClassName, Icon } = styles[tone];
  return <div aria-live="polite" className={cn('flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-5', toneClassName, className)} role="status" {...props}><Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{children}</div>;
}
