import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange?: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const changePage = (nextPage: number) => onPageChange?.(nextPage);
  const canGoBack = page > 1 && onPageChange !== undefined;
  const canGoForward = page < totalPages && onPageChange !== undefined;

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-100 px-1 pt-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
      <span>صفحه {new Intl.NumberFormat('fa-IR').format(page)} از {new Intl.NumberFormat('fa-IR').format(totalPages)} · {new Intl.NumberFormat('fa-IR').format(total)} مورد</span>
      <div className="flex items-center gap-2">
        <Button aria-label="صفحه بعد" disabled={!canGoForward} onClick={() => changePage(page + 1)} size="sm" variant="secondary">
          <ChevronRight className="size-4" aria-hidden="true" />
          بعد
        </Button>
        <Button aria-label="صفحه قبل" disabled={!canGoBack} onClick={() => changePage(page - 1)} size="sm" variant="secondary">
          قبل
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
