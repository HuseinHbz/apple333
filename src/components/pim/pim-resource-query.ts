'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { adminApiRequest } from '@/modules/admin/api-client';
import type { AdminDataState, AdminListPageData } from '@/modules/admin/types';

export type PimPage<T> = Readonly<{
  items: readonly T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}>;

export function usePimPage<T>(resource: string, path: string, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'pim', resource, path],
    queryFn: () => adminApiRequest<PimPage<T>>(path),
    enabled,
    staleTime: 15_000,
  });
}

export function toPimListState<T>(
  query: UseQueryResult<PimPage<T>, Error>,
): AdminDataState<AdminListPageData<T>> {
  if (query.isPending) return { kind: 'loading' };
  if (query.isError) {
    return {
      kind: 'unavailable',
      reason: 'اطلاعات PIM در حال حاضر از سرویس مدیریت دریافت نشد. مجوز و اتصال سرویس را بررسی کنید.',
    };
  }
  if (!query.data || query.data.items.length === 0) return { kind: 'empty' };
  return {
    kind: 'ready',
    data: {
      rows: query.data.items,
      page: query.data.page,
      pageSize: query.data.pageSize,
      total: query.data.total,
    },
  };
}

export function pimQuery(values: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}
