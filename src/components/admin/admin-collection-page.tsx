'use client';

import { ListFilter, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import type { AdminDataState, AdminListPageData } from '@/modules/admin/types';
import { AdminPageState } from './admin-page-state';

interface AdminCollectionPageProps<T> {
  state: AdminDataState<AdminListPageData<T>>;
  columns: readonly DataTableColumn<T>[];
  getRowKey: (row: T) => string;
  emptyTitle: string;
  emptyDescription: string;
  searchPlaceholder: string;
  filterLabel: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterOptions?: readonly { value: string; label: string }[];
  onPageChange?: (page: number) => void;
  isFetching?: boolean;
  matchesSearch?: (row: T, search: string) => boolean;
  matchesFilter?: (row: T, filter: string) => boolean;
  remoteFiltering?: boolean;
  toolbarTrailing?: ReactNode;
}

export function AdminCollectionPage<T>({
  state,
  columns,
  getRowKey,
  emptyTitle,
  emptyDescription,
  searchPlaceholder,
  filterLabel,
  searchValue = '',
  onSearchChange,
  filterValue = '',
  onFilterChange,
  filterOptions = [],
  onPageChange,
  isFetching = false,
  matchesSearch,
  matchesFilter,
  remoteFiltering = false,
  toolbarTrailing
}: AdminCollectionPageProps<T>) {
  const [localSearch, setLocalSearch] = useState('');
  const [localFilter, setLocalFilter] = useState('');
  const activeSearch = onSearchChange ? searchValue : localSearch;
  const activeFilter = onFilterChange ? filterValue : localFilter;

  return (
    <AdminPageState state={state} emptyTitle={emptyTitle} emptyDescription={emptyDescription}>
      {(page) => (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-3 sm:flex-row sm:items-center">
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">جست‌وجو</span>
              <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
              <Input
                className="pr-9"
                onChange={(event) => {
                  const value = event.target.value;
                  if (onSearchChange) onSearchChange(value);
                  else setLocalSearch(value);
                }}
                placeholder={searchPlaceholder}
                type="search"
                value={activeSearch}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-500">
              <ListFilter className="size-4" aria-hidden="true" />
              <span className="sr-only">فیلتر</span>
              <Select
                aria-label={filterLabel}
                className="min-w-40"
                onChange={(event) => {
                  const value = event.target.value;
                  if (onFilterChange) onFilterChange(value);
                  else setLocalFilter(value);
                }}
                value={activeFilter}
              >
                <option value="">{filterLabel}</option>
                {filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </label>
            {toolbarTrailing}
          </div>
          {isFetching ? <p aria-live="polite" className="px-1 text-xs text-zinc-500">در حال به‌روزرسانی داده‌ها…</p> : null}
          <CollectionRows
            activeFilter={activeFilter}
            activeSearch={activeSearch}
            columns={columns}
            emptyDescription={emptyDescription}
            getRowKey={getRowKey}
            matchesFilter={matchesFilter}
            matchesSearch={matchesSearch}
            onPageChange={onPageChange}
            page={page}
            remoteFiltering={remoteFiltering}
          />
        </div>
      )}
    </AdminPageState>
  );
}

function defaultMatch(row: unknown, value: string): boolean {
  return JSON.stringify(row).toLocaleLowerCase('fa-IR').includes(value.toLocaleLowerCase('fa-IR'));
}

function CollectionRows<T>({
  page,
  activeSearch,
  activeFilter,
  columns,
  getRowKey,
  emptyDescription,
  onPageChange,
  matchesSearch,
  matchesFilter,
  remoteFiltering,
}: {
  page: AdminListPageData<T>;
  activeSearch: string;
  activeFilter: string;
  columns: readonly DataTableColumn<T>[];
  getRowKey: (row: T) => string;
  emptyDescription: string;
  onPageChange?: ((page: number) => void) | undefined;
  matchesSearch?: ((row: T, search: string) => boolean) | undefined;
  matchesFilter?: ((row: T, filter: string) => boolean) | undefined;
  remoteFiltering: boolean;
}) {
  const rows = useMemo(() => page.rows.filter((row) => {
    const searchMatches = !activeSearch || (matchesSearch ?? defaultMatch)(row, activeSearch);
    const filterMatches = !activeFilter || (matchesFilter ?? defaultMatch)(row, activeFilter);
    return searchMatches && filterMatches;
  }), [activeFilter, activeSearch, matchesFilter, matchesSearch, page.rows]);
  const filtered = !remoteFiltering && Boolean(activeSearch || activeFilter);
  const pagination = filtered
    ? { page: 1, pageSize: Math.max(rows.length, 1), total: rows.length }
    : page;

  return (
    <>
      <DataTable columns={columns} emptyMessage={emptyDescription} getRowKey={getRowKey} rows={remoteFiltering ? page.rows : rows} />
      <Pagination {...(!filtered && onPageChange ? { onPageChange } : {})} page={pagination.page} pageSize={pagination.pageSize} total={pagination.total} />
    </>
  );
}
