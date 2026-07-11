import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from './cn';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon: Icon = Inbox, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 px-6 py-10 text-center', className)}>
      <span className="mb-4 inline-flex size-11 items-center justify-center rounded-2xl bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-200">
        <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />
      </span>
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
