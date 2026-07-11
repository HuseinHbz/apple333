'use client';

import { useQuery } from '@tanstack/react-query';

export type AdminApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
};

export async function adminApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  const envelope = await response.json() as AdminApiEnvelope<T>;
  if (!response.ok || !envelope.success || envelope.data === undefined) {
    throw new Error(envelope.error?.code ?? 'ADMIN_API_UNAVAILABLE');
  }
  return envelope.data;
}

type NotificationSummary = { total: number };

export function useAdminNotificationSummary(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'notifications', 'pending-count'],
    queryFn: () => adminApiRequest<NotificationSummary>('/api/admin/notifications?page=1&pageSize=1&status=PENDING'),
    enabled,
    refetchInterval: 60_000
  });
}
