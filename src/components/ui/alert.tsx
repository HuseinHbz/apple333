import type { HTMLAttributes } from 'react';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { cn } from './cn';

type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const alertStyle: Record<AlertTone, { className: string; Icon: typeof Info }> = {
  info: { className: 'border-sky-200 bg-sky-50 text-sky-900', Icon: Info },
  success: { className: 'border-emerald-200 bg-emerald-50 text-emerald-900', Icon: CircleCheck },
  warning: { className: 'border-amber-200 bg-amber-50 text-amber-900', Icon: CircleAlert },
  danger: { className: 'border-red-200 bg-red-50 text-red-900', Icon: CircleAlert }
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
  title: string;
}

export function Alert({ className, tone = 'info', title, children, ...props }: AlertProps) {
  const { className: toneClassName, Icon } = alertStyle[tone];
  return (
    <div className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', toneClassName, className)} role="status" {...props}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div><p className="font-semibold">{title}</p>{children ? <div className="mt-1 leading-6 opacity-80">{children}</div> : null}</div>
    </div>
  );
}
