'use client';

import { UploadCloud } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { cn } from './cn';

export interface FilePickerProps {
  accept: string;
  maxBytes: number;
  disabled?: boolean;
  onFilesAccepted?: (files: readonly File[]) => void;
  onRejected?: (reason: string) => void;
  className?: string;
}

export function FilePicker({ accept, maxBytes, disabled = false, onFilesAccepted, onRejected, className }: FilePickerProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const oversized = files.find((file) => file.size > maxBytes);
    if (oversized) {
      onRejected?.(`حجم «${oversized.name}» از سقف مجاز بیشتر است.`);
      event.currentTarget.value = '';
      return;
    }
    onFilesAccepted?.(files);
  };

  return (
    <label className={cn('flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-6 text-center transition hover:border-zinc-400 hover:bg-zinc-100/70 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60', className)}>
      <UploadCloud className="size-6 text-zinc-500" aria-hidden="true" />
      <span className="mt-3 text-sm font-semibold text-zinc-800">انتخاب فایل</span>
      <span className="mt-1 text-xs leading-5 text-zinc-500">نوع و حجم فایل پیش از ارسال اعتبارسنجی می‌شود.</span>
      <input accept={accept} className="sr-only" disabled={disabled} multiple onChange={handleChange} type="file" />
    </label>
  );
}
