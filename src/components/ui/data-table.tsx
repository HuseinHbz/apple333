import type { ReactNode } from 'react';
import { cn } from './cn';

export interface DataTableColumn<T> {
  id: string;
  header: string;
  className?: string;
  cell: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>({ columns, rows, getRowKey, emptyMessage = 'داده‌ای برای نمایش وجود ندارد.', className }: DataTableProps<T>) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-zinc-200 bg-white', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42.5rem] border-collapse text-right text-sm">
          <thead className="bg-zinc-50 text-xs font-semibold text-zinc-500">
            <tr>
              {columns.map((column) => (
                <th key={column.id} className={cn('whitespace-nowrap px-5 py-3.5', column.className)} scope="col">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.length ? (
              rows.map((row) => (
                <tr key={getRowKey(row)} className="text-zinc-700 transition hover:bg-zinc-50/80">
                  {columns.map((column) => (
                    <td key={column.id} className={cn('px-5 py-4 align-middle', column.className)}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-5 py-12 text-center text-sm text-zinc-500" colSpan={columns.length}>
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
