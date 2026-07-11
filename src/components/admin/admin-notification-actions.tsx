'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { adminApiRequest } from '@/modules/admin/api-client';
import type { AdminNotificationRow } from '@/modules/admin/types';

export function AdminNotificationRowActions({ canUpdate, notification }: { canUpdate: boolean; notification: AdminNotificationRow }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const markRead = useMutation({
    mutationFn: () => adminApiRequest(`/api/admin/notifications/${encodeURIComponent(notification.id)}`, { method: 'PATCH' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
      router.refresh();
    },
  });
  if (!canUpdate || notification.status === 'READ') return null;
  return (
    <div className="flex items-center gap-2">
      <Button disabled={markRead.isPending} onClick={() => markRead.mutate()} size="sm" variant="secondary"><CheckCheck className="size-3.5" aria-hidden="true" /> خوانده شد</Button>
      {markRead.isError ? <span className="text-xs text-red-600">ثبت نشد.</span> : null}
    </div>
  );
}
