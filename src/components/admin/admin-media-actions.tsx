'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { adminApiRequest } from '@/modules/admin/api-client';
import type { AdminMediaRow } from '@/modules/admin/types';

export function AdminMediaRowActions({ canDelete, file }: { canDelete: boolean; file: AdminMediaRow }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const remove = useMutation({
    mutationFn: () => adminApiRequest(`/api/admin/media/${encodeURIComponent(file.id)}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'media'] });
      router.refresh();
    },
  });

  return (
    <div className="flex flex-wrap gap-2">
      {file.url ? <a className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50" href={file.url} rel="noreferrer" target="_blank"><ExternalLink className="size-3.5" aria-hidden="true" /> نمایش</a> : <span className="text-xs text-zinc-400">آدرس آماده نیست</span>}
      {canDelete ? <ConfirmDialog confirmLabel="حذف رسانه" destructive description="رسانه به‌صورت soft delete حذف و رویداد ممیزی ثبت می‌شود." onConfirm={() => remove.mutate()} title={`حذف ${file.originalName}`} trigger={<Button disabled={remove.isPending} size="sm" variant="danger"><Trash2 className="size-3.5" aria-hidden="true" /> حذف</Button>} /> : null}
      {remove.isError ? <span className="text-xs text-red-600">حذف انجام نشد.</span> : null}
    </div>
  );
}
