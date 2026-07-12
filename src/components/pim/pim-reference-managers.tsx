'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { AdminCollectionPage } from '@/components/admin/admin-collection-page';
import { useDebouncedValue } from '@/components/admin/admin-resource-query';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { Select } from '@/components/ui/select';
import { adminApiRequest } from '@/modules/admin/api-client';
import type { AdminBrandDto, AdminCategoryDto, AdminWarrantyDto } from '@/modules/pim/types';
import { pimQuery, toPimListState, usePimPage } from './pim-resource-query';
import { activeStatusLabel, codeFromText, errorText, formatPimDate, slugFromName } from './pim-utils';

type ReferencePermissions = Readonly<{
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}>;

function DeleteReferenceAction({
  canDelete,
  entityId,
  entityLabel,
  resource,
  title,
}: {
  canDelete: boolean;
  entityId: string;
  entityLabel: string;
  resource: 'brands' | 'categories' | 'warranties';
  title: string;
}) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => adminApiRequest<{ deleted: boolean }>(`/api/admin/${resource}/${encodeURIComponent(entityId)}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'pim', resource] }),
  });
  if (!canDelete) return null;
  return (
    <div className="flex items-center gap-2">
      <ConfirmDialog
        confirmLabel={`حذف ${title}`}
        destructive
        description="درخواست حذف به سرویس امن ارسال می‌شود. سرویس پیش از حذف، وابستگی‌های محصول را بررسی و رخداد ممیزی ثبت می‌کند."
        onConfirm={() => remove.mutate()}
        title={`حذف «${entityLabel}»`}
        trigger={<Button disabled={remove.isPending} size="sm" variant="danger"><Trash2 aria-hidden="true" className="size-3.5" /> حذف</Button>}
      />
      {remove.isError ? <span className="text-xs text-red-600">{errorText(remove.error)}</span> : null}
    </div>
  );
}

function FormError({ error, title }: { error: unknown; title: string }) {
  return error ? <Alert title={title} tone="danger">{errorText(error)}</Alert> : null;
}

function BrandEditor({ brand, canCreate = false, canUpdate = false }: { brand?: AdminBrandDto; canCreate?: boolean; canUpdate?: boolean }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(brand?.code ?? '');
  const [slug, setSlug] = useState(brand?.slug ?? '');
  const [name, setName] = useState(brand?.name ?? '');
  const [description, setDescription] = useState(brand?.description ?? '');
  const [status, setStatus] = useState<AdminBrandDto['status']>(brand?.status ?? 'DRAFT');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setCode(brand?.code ?? '');
    setSlug(brand?.slug ?? '');
    setName(brand?.name ?? '');
    setDescription(brand?.description ?? '');
    setStatus(brand?.status ?? 'DRAFT');
  }, [brand, open]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        code: code.trim().toUpperCase(),
        slug: slug.trim().toLowerCase(),
        name: name.trim(),
        description: description.trim() || null,
        status,
      };
      return adminApiRequest<AdminBrandDto>(brand ? `/api/admin/brands/${encodeURIComponent(brand.id)}` : '/api/admin/brands', {
        method: brand ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'pim', 'brands'] });
      setOpen(false);
    },
  });
  const allowed = brand ? canUpdate : canCreate;
  if (!allowed) return null;
  return (
    <ModalDialog
      description="کد و اسلاگ برند پس از ذخیره، در پیوندهای محصول و دادهٔ جست‌وجو استفاده می‌شوند."
      onOpenChange={setOpen}
      open={open}
      title={brand ? `ویرایش برند ${brand.name}` : 'افزودن برند'}
      trigger={brand ? <Button size="sm" variant="secondary"><Pencil aria-hidden="true" className="size-3.5" /> ویرایش</Button> : <Button><Plus aria-hidden="true" className="size-4" /> برند جدید</Button>}
    >
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>نام برند</span><Input disabled={save.isPending} maxLength={160} onChange={(event) => { const next = event.target.value; setName(next); if (!brand) { setCode(codeFromText(next)); setSlug(slugFromName(next)); } }} required value={name} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>وضعیت</span><Select disabled={save.isPending} onChange={(event) => setStatus(event.target.value as AdminBrandDto['status'])} value={status}><option value="DRAFT">پیش‌نویس</option><option value="ACTIVE">فعال</option><option value="ARCHIVED">بایگانی‌شده</option></Select></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>کد</span><Input disabled={save.isPending} maxLength={96} onChange={(event) => setCode(event.target.value.toUpperCase())} required value={code} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>اسلاگ</span><Input dir="ltr" disabled={save.isPending} maxLength={160} onChange={(event) => setSlug(event.target.value.toLowerCase())} required value={slug} /></label>
        </div>
        <label className="block space-y-1.5 text-sm font-medium text-zinc-700"><span>توضیح</span><textarea className="min-h-24 w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100" disabled={save.isPending} maxLength={20_000} onChange={(event) => setDescription(event.target.value)} value={description} /></label>
        <FormError error={save.error} title="ذخیرهٔ برند انجام نشد" />
        <div className="flex justify-end"><Button disabled={save.isPending} type="submit"><Save aria-hidden="true" className="size-4" /> {save.isPending ? 'در حال ذخیره…' : 'ذخیرهٔ برند'}</Button></div>
      </form>
    </ModalDialog>
  );
}

export function PimBrandCreateAction({ canCreate = false }: { canCreate?: boolean }) {
  return <BrandEditor canCreate={canCreate} />;
}

export function PimBrandManager({ canCreate = false, canDelete = false, canUpdate = false }: ReferencePermissions) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const path = useMemo(() => `/api/admin/brands${pimQuery({ page, pageSize: 25, query: debouncedQuery })}`, [debouncedQuery, page]);
  const brands = usePimPage<AdminBrandDto>('brands', path);
  const columns: readonly DataTableColumn<AdminBrandDto>[] = [
    { id: 'name', header: 'برند', cell: (brand) => <div><p className="font-semibold text-zinc-900">{brand.name}</p><code className="mt-1 block text-xs text-zinc-500">{brand.code} · /{brand.slug}</code></div> },
    { id: 'status', header: 'وضعیت', cell: (brand) => <Badge tone={brand.status === 'ACTIVE' ? 'success' : brand.status === 'ARCHIVED' ? 'danger' : 'neutral'}>{brand.status === 'ACTIVE' ? 'فعال' : brand.status === 'ARCHIVED' ? 'بایگانی‌شده' : 'پیش‌نویس'}</Badge> },
    { id: 'updatedAt', header: 'آخرین تغییر', cell: (brand) => <time dateTime={brand.updatedAt}>{formatPimDate(brand.updatedAt)}</time> },
    { id: 'actions', header: 'عملیات', cell: (brand) => <div className="flex flex-wrap gap-2"><BrandEditor brand={brand} canUpdate={canUpdate} /><DeleteReferenceAction canDelete={canDelete} entityId={brand.id} entityLabel={brand.name} resource="brands" title="برند" /></div> },
  ];
  return <AdminCollectionPage columns={columns} emptyDescription="برندها نقطهٔ شروع طبقه‌بندی محصولات هستند؛ دادهٔ نمایشی در این بخش ساخته نمی‌شود." emptyTitle="برندی ثبت نشده است" filterLabel="فیلتر" getRowKey={(brand) => brand.id} isFetching={brands.isFetching} onPageChange={setPage} onSearchChange={(next) => { setQuery(next); setPage(1); }} remoteFiltering searchPlaceholder="جست‌وجو با نام، کد یا اسلاگ" searchValue={query} state={toPimListState(brands)} />;
}

function CategoryEditor({ category, canCreate = false, canUpdate = false }: { category?: AdminCategoryDto; canCreate?: boolean; canUpdate?: boolean }) {
  const [open, setOpen] = useState(false);
  const [parentId, setParentId] = useState(category?.parentId ?? '');
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [imageUrl, setImageUrl] = useState(category?.imageUrl ?? '');
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const queryClient = useQueryClient();
  const categories = usePimPage<AdminCategoryDto>('categories-options', '/api/admin/categories?page=1&pageSize=100', open);

  useEffect(() => {
    if (!open) return;
    setParentId(category?.parentId ?? '');
    setSlug(category?.slug ?? '');
    setName(category?.name ?? '');
    setDescription(category?.description ?? '');
    setImageUrl(category?.imageUrl ?? '');
    setSortOrder(String(category?.sortOrder ?? 0));
    setIsActive(category?.isActive ?? true);
  }, [category, open]);

  const save = useMutation({
    mutationFn: () => adminApiRequest<AdminCategoryDto>(category ? `/api/admin/categories/${encodeURIComponent(category.id)}` : '/api/admin/categories', {
      method: category ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        parentId: parentId || null,
        slug: slug.trim().toLowerCase(),
        name: name.trim(),
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        sortOrder: Number(sortOrder) || 0,
        isActive,
      }),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'pim', 'categories'] });
      setOpen(false);
    },
  });
  const allowed = category ? canUpdate : canCreate;
  if (!allowed) return null;
  return (
    <ModalDialog
      description="دسته‌ها می‌توانند یک سطح والد داشته باشند. تغییر ساختار فقط پس از اعتبارسنجی چرخه و وابستگی‌ها ذخیره می‌شود."
      onOpenChange={setOpen}
      open={open}
      title={category ? `ویرایش دسته ${category.name}` : 'افزودن دسته'}
      trigger={category ? <Button size="sm" variant="secondary"><Pencil aria-hidden="true" className="size-3.5" /> ویرایش</Button> : <Button><Plus aria-hidden="true" className="size-4" /> دسته جدید</Button>}
    >
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>نام دسته</span><Input disabled={save.isPending} maxLength={160} onChange={(event) => { const next = event.target.value; setName(next); if (!category) setSlug(slugFromName(next)); }} required value={name} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>دستهٔ والد</span><Select disabled={save.isPending || categories.isPending} onChange={(event) => setParentId(event.target.value)} value={parentId}><option value="">بدون والد (دستهٔ ریشه)</option>{(categories.data?.items ?? []).filter((item) => item.id !== category?.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>اسلاگ</span><Input dir="ltr" disabled={save.isPending} maxLength={160} onChange={(event) => setSlug(event.target.value.toLowerCase())} required value={slug} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>ترتیب نمایش</span><Input disabled={save.isPending} inputMode="numeric" maxLength={6} onChange={(event) => setSortOrder(event.target.value)} type="number" value={sortOrder} /></label>
        </div>
        <label className="block space-y-1.5 text-sm font-medium text-zinc-700"><span>نشانی تصویر</span><Input dir="ltr" disabled={save.isPending} maxLength={2048} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://…" type="url" value={imageUrl} /></label>
        <label className="block space-y-1.5 text-sm font-medium text-zinc-700"><span>توضیح</span><textarea className="min-h-24 w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100" disabled={save.isPending} maxLength={20_000} onChange={(event) => setDescription(event.target.value)} value={description} /></label>
        <label className="flex items-center gap-2 text-sm text-zinc-700"><input checked={isActive} disabled={save.isPending} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" /> دسته در کاتالوگ فعال باشد</label>
        <FormError error={save.error} title="ذخیرهٔ دسته انجام نشد" />
        <div className="flex justify-end"><Button disabled={save.isPending} type="submit"><Save aria-hidden="true" className="size-4" /> {save.isPending ? 'در حال ذخیره…' : 'ذخیرهٔ دسته'}</Button></div>
      </form>
    </ModalDialog>
  );
}

export function PimCategoryCreateAction({ canCreate = false }: { canCreate?: boolean }) {
  return <CategoryEditor canCreate={canCreate} />;
}

export function PimCategoryManager({ canCreate = false, canDelete = false, canUpdate = false }: ReferencePermissions) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const categories = usePimPage<AdminCategoryDto>('categories', `/api/admin/categories${pimQuery({ page, pageSize: 25, query: debouncedQuery })}`);
  const columns: readonly DataTableColumn<AdminCategoryDto>[] = [
    { id: 'name', header: 'دسته', cell: (category) => <div><p className="font-semibold text-zinc-900">{category.name}</p><code className="mt-1 block text-xs text-zinc-500">/{category.slug}</code></div> },
    { id: 'parent', header: 'ساختار', cell: (category) => <span className="text-xs text-zinc-600">{category.parentId ? 'دستهٔ فرزند' : 'ریشه'} · {new Intl.NumberFormat('fa-IR').format(category.childCount)} فرزند</span> },
    { id: 'products', header: 'محصولات', cell: (category) => new Intl.NumberFormat('fa-IR').format(category.productCount) },
    { id: 'status', header: 'وضعیت', cell: (category) => <Badge tone={category.isActive ? 'success' : 'neutral'}>{activeStatusLabel(category.isActive)}</Badge> },
    { id: 'updatedAt', header: 'آخرین تغییر', cell: (category) => <time dateTime={category.updatedAt}>{formatPimDate(category.updatedAt)}</time> },
    { id: 'actions', header: 'عملیات', cell: (category) => <div className="flex flex-wrap gap-2"><CategoryEditor canUpdate={canUpdate} category={category} /><DeleteReferenceAction canDelete={canDelete} entityId={category.id} entityLabel={category.name} resource="categories" title="دسته" /></div> },
  ];
  return <AdminCollectionPage columns={columns} emptyDescription="برای اتصال محصولات به ساختار کاتالوگ، ابتدا یک دستهٔ ریشه یا فرزند ثبت کنید." emptyTitle="دسته‌ای ثبت نشده است" filterLabel="فیلتر" getRowKey={(category) => category.id} isFetching={categories.isFetching} onPageChange={setPage} onSearchChange={(next) => { setQuery(next); setPage(1); }} remoteFiltering searchPlaceholder="جست‌وجو با نام یا اسلاگ دسته" searchValue={query} state={toPimListState(categories)} />;
}

function WarrantyEditor({ warranty, canCreate = false, canUpdate = false }: { warranty?: AdminWarrantyDto; canCreate?: boolean; canUpdate?: boolean }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(warranty?.code ?? '');
  const [provider, setProvider] = useState(warranty?.provider ?? '');
  const [name, setName] = useState(warranty?.name ?? '');
  const [durationMonths, setDurationMonths] = useState(String(warranty?.durationMonths ?? 18));
  const [terms, setTerms] = useState(warranty?.terms ?? '');
  const [conditions, setConditions] = useState(warranty?.conditions ?? '');
  const [isActive, setIsActive] = useState(warranty?.isActive ?? true);
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!open) return;
    setCode(warranty?.code ?? ''); setProvider(warranty?.provider ?? ''); setName(warranty?.name ?? ''); setDurationMonths(String(warranty?.durationMonths ?? 18)); setTerms(warranty?.terms ?? ''); setConditions(warranty?.conditions ?? ''); setIsActive(warranty?.isActive ?? true);
  }, [open, warranty]);
  const save = useMutation({
    mutationFn: () => adminApiRequest<AdminWarrantyDto>(warranty ? `/api/admin/warranties/${encodeURIComponent(warranty.id)}` : '/api/admin/warranties', {
      method: warranty ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase(), provider: provider.trim(), name: name.trim(), durationMonths: Number(durationMonths), terms: terms.trim() || null, conditions: conditions.trim() || null, isActive }),
    }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'pim', 'warranties'] }); setOpen(false); },
  });
  const allowed = warranty ? canUpdate : canCreate;
  if (!allowed) return null;
  return (
    <ModalDialog description="مدت، شرایط و ارائه‌دهندهٔ گارانتی در سطح تنوع محصول قابل اتصال خواهند بود." onOpenChange={setOpen} open={open} title={warranty ? `ویرایش گارانتی ${warranty.name}` : 'افزودن گارانتی'} trigger={warranty ? <Button size="sm" variant="secondary"><Pencil aria-hidden="true" className="size-3.5" /> ویرایش</Button> : <Button><Plus aria-hidden="true" className="size-4" /> گارانتی جدید</Button>}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>نام</span><Input disabled={save.isPending} maxLength={160} onChange={(event) => { const next = event.target.value; setName(next); if (!warranty) setCode(codeFromText(next)); }} required value={name} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>ارائه‌دهنده</span><Input disabled={save.isPending} maxLength={160} onChange={(event) => setProvider(event.target.value)} required value={provider} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>کد</span><Input disabled={save.isPending} maxLength={96} onChange={(event) => setCode(event.target.value.toUpperCase())} required value={code} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>مدت (ماه)</span><Input disabled={save.isPending} max="120" min="0" onChange={(event) => setDurationMonths(event.target.value)} required type="number" value={durationMonths} /></label>
        </div>
        <label className="block space-y-1.5 text-sm font-medium text-zinc-700"><span>شرایط</span><textarea className="min-h-20 w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100" disabled={save.isPending} maxLength={20_000} onChange={(event) => setTerms(event.target.value)} value={terms} /></label>
        <label className="block space-y-1.5 text-sm font-medium text-zinc-700"><span>محدودیت‌ها و توضیحات</span><textarea className="min-h-20 w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100" disabled={save.isPending} maxLength={20_000} onChange={(event) => setConditions(event.target.value)} value={conditions} /></label>
        <label className="flex items-center gap-2 text-sm text-zinc-700"><input checked={isActive} disabled={save.isPending} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" /> گارانتی فعال باشد</label>
        <FormError error={save.error} title="ذخیرهٔ گارانتی انجام نشد" />
        <div className="flex justify-end"><Button disabled={save.isPending} type="submit"><Save aria-hidden="true" className="size-4" /> {save.isPending ? 'در حال ذخیره…' : 'ذخیرهٔ گارانتی'}</Button></div>
      </form>
    </ModalDialog>
  );
}

export function PimWarrantyCreateAction({ canCreate = false }: { canCreate?: boolean }) {
  return <WarrantyEditor canCreate={canCreate} />;
}

export function PimWarrantyManager({ canCreate = false, canDelete = false, canUpdate = false }: ReferencePermissions) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const warranties = usePimPage<AdminWarrantyDto>('warranties', `/api/admin/warranties${pimQuery({ page, pageSize: 25, query: debouncedQuery })}`);
  const columns: readonly DataTableColumn<AdminWarrantyDto>[] = [
    { id: 'name', header: 'گارانتی', cell: (warranty) => <div><p className="font-semibold text-zinc-900">{warranty.name}</p><p className="mt-1 text-xs text-zinc-500">{warranty.provider} · {warranty.code}</p></div> },
    { id: 'duration', header: 'مدت', cell: (warranty) => `${new Intl.NumberFormat('fa-IR').format(warranty.durationMonths)} ماه` },
    { id: 'variants', header: 'تنوع‌های متصل', cell: (warranty) => new Intl.NumberFormat('fa-IR').format(warranty.variantCount) },
    { id: 'status', header: 'وضعیت', cell: (warranty) => <Badge tone={warranty.isActive ? 'success' : 'neutral'}>{activeStatusLabel(warranty.isActive)}</Badge> },
    { id: 'updatedAt', header: 'آخرین تغییر', cell: (warranty) => <time dateTime={warranty.updatedAt}>{formatPimDate(warranty.updatedAt)}</time> },
    { id: 'actions', header: 'عملیات', cell: (warranty) => <div className="flex flex-wrap gap-2"><WarrantyEditor canUpdate={canUpdate} warranty={warranty} /><DeleteReferenceAction canDelete={canDelete} entityId={warranty.id} entityLabel={warranty.name} resource="warranties" title="گارانتی" /></div> },
  ];
  return <AdminCollectionPage columns={columns} emptyDescription="برای اتصال گارانتی به SKUها، ابتدا ارائه‌دهنده و شرایط آن را تعریف کنید." emptyTitle="گارانتی‌ای ثبت نشده است" filterLabel="فیلتر" getRowKey={(warranty) => warranty.id} isFetching={warranties.isFetching} onPageChange={setPage} onSearchChange={(next) => { setQuery(next); setPage(1); }} remoteFiltering searchPlaceholder="جست‌وجو با نام، ارائه‌دهنده یا کد" searchValue={query} state={toPimListState(warranties)} />;
}
