'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { AdminCollectionPage } from '@/components/admin/admin-collection-page';
import { useDebouncedValue } from '@/components/admin/admin-resource-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { DataTableColumn } from '@/components/ui/data-table';
import { adminApiRequest } from '@/modules/admin/api-client';
import type { AdminBrandDto, AdminCategoryDto, AdminProductListItemDto } from '@/modules/pim/types';
import { pimQuery, toPimListState, usePimPage } from './pim-resource-query';
import { errorText, formatPimDate, productStatusLabel, productStatusTone as productStatusToneValue } from './pim-utils';

const productStatusOptions = [
  { value: 'DRAFT', label: 'پیش‌نویس' },
  { value: 'REVIEW', label: 'در انتظار بررسی' },
  { value: 'PUBLISHED', label: 'منتشرشده' },
  { value: 'ARCHIVED', label: 'بایگانی‌شده' },
] as const;

const productStatusTone = (status: Parameters<typeof productStatusToneValue>[0]) => productStatusToneValue(status) ?? 'neutral';

function ProductRowActions({
  canDelete,
  canUpdate,
  product,
}: {
  canDelete: boolean;
  canUpdate: boolean;
  product: AdminProductListItemDto;
}) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => adminApiRequest<{ deleted: boolean }>(`/api/admin/products/${encodeURIComponent(product.id)}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version: product.version }),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'pim', 'products'] }),
  });

  if (!canUpdate && !canDelete) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {canUpdate ? (
        <Link href={`/admin/products/${encodeURIComponent(product.id)}`}>
          <Button size="sm" variant="secondary"><Pencil aria-hidden="true" className="size-3.5" /> ویرایش</Button>
        </Link>
      ) : null}
      {canDelete ? (
        <ConfirmDialog
          confirmLabel="حذف محصول"
          destructive
          description="حذف، نرم است و تنها پس از اعمال همهٔ کنترل‌های وابستگی و ثبت رخداد ممیزی در سرویس انجام می‌شود."
          onConfirm={() => remove.mutate()}
          title={`حذف «${product.name}»`}
          trigger={<Button disabled={remove.isPending} size="sm" variant="danger"><Trash2 aria-hidden="true" className="size-3.5" /> حذف</Button>}
        />
      ) : null}
      {remove.isError ? <span className="max-w-32 text-xs text-red-600">{errorText(remove.error)}</span> : null}
    </div>
  );
}

export function PimProductList({
  canDelete = false,
  canUpdate = false,
}: {
  canDelete?: boolean;
  canUpdate?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const debouncedQuery = useDebouncedValue(query);
  const brands = usePimPage<AdminBrandDto>('brands-options', '/api/admin/brands?page=1&pageSize=100');
  const categories = usePimPage<AdminCategoryDto>('categories-options', '/api/admin/categories?page=1&pageSize=100');
  const path = useMemo(() => `/api/admin/products${pimQuery({
    page,
    pageSize: 25,
    query: debouncedQuery,
    status,
    brandId,
    categoryId,
    includeArchived,
  })}`, [brandId, categoryId, debouncedQuery, includeArchived, page, status]);
  const products = usePimPage<AdminProductListItemDto>('products', path);
  const state = toPimListState(products);

  const columns: readonly DataTableColumn<AdminProductListItemDto>[] = [
    {
      id: 'product',
      header: 'محصول',
      cell: (product) => (
        <div className="min-w-52">
          <Link className="font-semibold text-zinc-900 hover:underline" href={`/admin/products/${encodeURIComponent(product.id)}`}>{product.name}</Link>
          <code className="mt-1 block text-xs text-zinc-500">/{product.slug}</code>
        </div>
      ),
    },
    {
      id: 'taxonomy',
      header: 'برند / دسته',
      cell: (product) => (
        <div className="space-y-1 text-xs">
          <p className="font-medium text-zinc-800">{product.brand?.name ?? product.legacyBrand}</p>
          <p className="text-zinc-500">{product.category?.name ?? 'بدون دسته'}</p>
        </div>
      ),
    },
    { id: 'status', header: 'وضعیت', cell: (product) => <Badge tone={productStatusTone(product.status)}>{productStatusLabel(product.status)}</Badge> },
    {
      id: 'variants',
      header: 'تنوع‌ها',
      cell: (product) => (
        <span className="text-sm text-zinc-700">
          {new Intl.NumberFormat('fa-IR').format(product.activeVariantCount)} فعال از {new Intl.NumberFormat('fa-IR').format(product.variantCount)}
        </span>
      ),
    },
    { id: 'updatedAt', header: 'آخرین تغییر', cell: (product) => <time dateTime={product.updatedAt}>{formatPimDate(product.updatedAt)}</time> },
    { id: 'actions', header: 'عملیات', cell: (product) => <ProductRowActions canDelete={canDelete} canUpdate={canUpdate} product={product} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 md:grid-cols-3">
        <label className="space-y-1 text-xs font-medium text-zinc-600">
          <span>برند</span>
          <select className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm" onChange={(event) => { setBrandId(event.target.value); setPage(1); }} value={brandId}>
            <option value="">همهٔ برندها</option>
            {(brands.data?.items ?? []).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-zinc-600">
          <span>دسته</span>
          <select className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm" onChange={(event) => { setCategoryId(event.target.value); setPage(1); }} value={categoryId}>
            <option value="">همهٔ دسته‌ها</option>
            {(categories.data?.items ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm text-zinc-700">
          <input checked={includeArchived} onChange={(event) => { setIncludeArchived(event.target.checked); setPage(1); }} type="checkbox" />
          نمایش محصولات بایگانی‌شده
        </label>
      </div>
      <AdminCollectionPage
        columns={columns}
        emptyDescription="پس از ثبت اولین محصول، تنوع‌ها، مشخصات و رسانه‌ها از همین بخش مدیریت می‌شوند."
        emptyTitle="محصولی با این معیارها وجود ندارد"
        filterLabel="همه وضعیت‌ها"
        filterOptions={productStatusOptions}
        filterValue={status}
        getRowKey={(product) => product.id}
        isFetching={products.isFetching}
        onFilterChange={(nextStatus) => { setStatus(nextStatus); setPage(1); }}
        onPageChange={setPage}
        onSearchChange={(nextQuery) => { setQuery(nextQuery); setPage(1); }}
        remoteFiltering
        searchPlaceholder="جست‌وجو با نام، اسلاگ یا SKU"
        searchValue={query}
        state={state}
      />
      {(brands.isError || categories.isError) ? <p className="text-xs text-amber-700">گزینه‌های فیلتر برند یا دسته فعلاً در دسترس نیستند؛ جست‌وجوی محصول همچنان فعال است.</p> : null}
      {products.isFetching ? <p className="text-xs text-zinc-500">در حال به‌روزرسانی فهرست محصولات…</p> : null}
      {products.data?.items.length === 0 && !products.isPending ? <div className="hidden"><Archive aria-hidden="true" /></div> : null}
    </div>
  );
}
