'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { adminApiRequest } from '@/modules/admin/api-client';

export type InventoryPage<T> = Readonly<{
  items: readonly T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}>;

export function useInventoryPage<T>(resource: string, path: string, enabled = true): UseQueryResult<InventoryPage<T>, Error> {
  return useQuery({
    queryKey: ['admin', 'inventory', resource, path],
    queryFn: () => adminApiRequest<InventoryPage<T>>(path),
    enabled,
    staleTime: 10_000,
  });
}

export function inventoryQuery(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

export function idempotencyKey(): string {
  return crypto.randomUUID();
}
