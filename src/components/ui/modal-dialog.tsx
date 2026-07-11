'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export interface ModalDialogProps {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Small, accessible Radix wrapper shared by management forms. Individual forms
 * own validation and submit state so this primitive stays presentation-only.
 */
export function ModalDialog({
  trigger,
  title,
  description,
  children,
  open,
  onOpenChange,
}: ModalDialogProps) {
  const controlledProps = {
    ...(open === undefined ? {} : { open }),
    ...(onOpenChange === undefined ? {} : { onOpenChange }),
  };

  return (
    <Dialog.Root {...controlledProps}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/30 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl focus:outline-none"
          dir="rtl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-zinc-950">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-2 text-sm leading-6 text-zinc-500">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close aria-label="بستن" className="rounded-lg p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900">
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="mt-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
