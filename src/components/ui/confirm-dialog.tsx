'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';

export interface ConfirmDialogProps {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm?: () => void;
  destructive?: boolean;
}

export function ConfirmDialog({ trigger, title, description, confirmLabel, onConfirm, destructive = false }: ConfirmDialogProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl focus:outline-none" dir="rtl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-zinc-950">{title}</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-zinc-500">{description}</Dialog.Description>
            </div>
            <Dialog.Close aria-label="بستن" className="rounded-lg p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900">
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3">
            <Dialog.Close asChild>
              <Button variant="secondary">انصراف</Button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
