import type { Page, PageInput } from './types';

export function toPage<T>(
  items: readonly T[],
  input: PageInput,
  total: number,
): Page<T> {
  return {
    items,
    page: input.page,
    pageSize: input.pageSize,
    total,
    totalPages: Math.ceil(total / input.pageSize),
  };
}
