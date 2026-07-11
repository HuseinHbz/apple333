'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { adminApiRequest } from '@/modules/admin/api-client';
import type { AdminDataState } from '@/modules/admin/types';

export interface AdminPageResult<T> {
  items: readonly T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function useAdminResourceQuery<T>(resource: string, path: string, enabled = true) {
  return useQuery({
    queryKey: ['admin', resource, path],
    queryFn: () => adminApiRequest<T>(path),
    enabled,
  });
}

export function toAdminDataState<T>(
  query: UseQueryResult<T, Error>,
  isEmpty: (data: T) => boolean = () => false,
): AdminDataState<T> {
  if (query.isPending) {
    return { kind: 'loading' };
  }
  if (query.isError) {
    return { kind: 'unavailable', reason: 'داده‌ها در حال حاضر از سرویس مدیریتی دریافت نشدند.' };
  }
  if (query.data === undefined || isEmpty(query.data)) {
    return { kind: 'empty' };
  }
  return { kind: 'ready', data: query.data };
}

export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debounced;
}

export function queryString(values: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}
