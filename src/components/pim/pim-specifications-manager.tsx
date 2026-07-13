'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers3, Pencil, Plus, Save, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { AdminCollectionPage } from '@/components/admin/admin-collection-page';
import { useDebouncedValue } from '@/components/admin/admin-resource-query';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { Select } from '@/components/ui/select';
import { adminApiRequest } from '@/modules/admin/api-client';
import type { AdminProductAttributeDto, AdminSpecificationGroupDto } from '@/modules/pim/types';
import { pimQuery, toPimListState, usePimPage } from './pim-resource-query';
import { activeStatusLabel, codeFromText, errorText, formatPimDate } from './pim-utils';

type SpecificationPermissions = Readonly<{
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}>;

function MutationError({ error, title }: { error: unknown; title: string }) {
  return error ? <Alert title={title} tone="danger">{errorText(error)}</Alert> : null;
}

function SpecificationGroupEditor({ group, canCreate = false, canUpdate = false }: { group?: AdminSpecificationGroupDto; canCreate?: boolean; canUpdate?: boolean }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(group?.code ?? '');
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [sortOrder, setSortOrder] = useState(String(group?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(group?.isActive ?? true);
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!open) return;
    setCode(group?.code ?? ''); setName(group?.name ?? ''); setDescription(group?.description ?? ''); setSortOrder(String(group?.sortOrder ?? 0)); setIsActive(group?.isActive ?? true);
  }, [group, open]);
  const save = useMutation({
    mutationFn: () => adminApiRequest<AdminSpecificationGroupDto>(group ? `/api/admin/specification-groups/${encodeURIComponent(group.id)}` : '/api/admin/specification-groups', {
      method: group ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase(), name: name.trim(), description: description.trim() || null, sortOrder: Number(sortOrder) || 0, isActive }),
    }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'pim', 'specification-groups'] }); setOpen(false); },
  });
  const allowed = group ? canUpdate : canCreate;
  if (!allowed) return null;
  return (
    <ModalDialog description="گروه‌ها ترتیب و خوانایی مشخصات را در صفحهٔ محصول و مقایسه کنترل می‌کنند." onOpenChange={setOpen} open={open} title={group ? `ویرایش گروه ${group.name}` : 'افزودن گروه مشخصات'} trigger={group ? <Button size="sm" variant="secondary"><Pencil aria-hidden="true" className="size-3.5" /> ویرایش</Button> : <Button><Plus aria-hidden="true" className="size-4" /> گروه مشخصات</Button>}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>نام گروه</span><Input disabled={save.isPending} maxLength={160} onChange={(event) => { const next = event.target.value; setName(next); if (!group) setCode(codeFromText(next)); }} required value={name} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>کد</span><Input disabled={save.isPending} maxLength={96} onChange={(event) => setCode(event.target.value.toUpperCase())} required value={code} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>ترتیب نمایش</span><Input disabled={save.isPending} onChange={(event) => setSortOrder(event.target.value)} type="number" value={sortOrder} /></label>
          <label className="flex items-end gap-2 pb-2 text-sm text-zinc-700"><input checked={isActive} disabled={save.isPending} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" /> گروه فعال باشد</label>
        </div>
        <label className="block space-y-1.5 text-sm font-medium text-zinc-700"><span>توضیح</span><textarea className="min-h-24 w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100" disabled={save.isPending} maxLength={20_000} onChange={(event) => setDescription(event.target.value)} value={description} /></label>
        <MutationError error={save.error} title="ذخیرهٔ گروه مشخصات انجام نشد" />
        <div className="flex justify-end"><Button disabled={save.isPending} type="submit"><Save aria-hidden="true" className="size-4" /> {save.isPending ? 'در حال ذخیره…' : 'ذخیرهٔ گروه'}</Button></div>
      </form>
    </ModalDialog>
  );
}

function AttributeEditor({ attribute, canCreate = false, canUpdate = false }: { attribute?: AdminProductAttributeDto; canCreate?: boolean; canUpdate?: boolean }) {
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState(attribute?.groupId ?? '');
  const [code, setCode] = useState(attribute?.code ?? '');
  const [name, setName] = useState(attribute?.name ?? '');
  const [valueType, setValueType] = useState<AdminProductAttributeDto['valueType']>(attribute?.valueType ?? 'TEXT');
  const [unitCode, setUnitCode] = useState(attribute?.unitCode ?? '');
  const [sortOrder, setSortOrder] = useState(String(attribute?.sortOrder ?? 0));
  const [isFilterable, setIsFilterable] = useState(attribute?.isFilterable ?? false);
  const [isSearchable, setIsSearchable] = useState(attribute?.isSearchable ?? true);
  const [isRequiredDefault, setIsRequiredDefault] = useState(attribute?.isRequiredDefault ?? false);
  const [isActive, setIsActive] = useState(attribute?.isActive ?? true);
  const groups = usePimPage<AdminSpecificationGroupDto>('specification-groups-options', '/api/admin/specification-groups?page=1&pageSize=100', open);
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!open) return;
    setGroupId(attribute?.groupId ?? ''); setCode(attribute?.code ?? ''); setName(attribute?.name ?? ''); setValueType(attribute?.valueType ?? 'TEXT'); setUnitCode(attribute?.unitCode ?? ''); setSortOrder(String(attribute?.sortOrder ?? 0)); setIsFilterable(attribute?.isFilterable ?? false); setIsSearchable(attribute?.isSearchable ?? true); setIsRequiredDefault(attribute?.isRequiredDefault ?? false); setIsActive(attribute?.isActive ?? true);
  }, [attribute, open]);
  const save = useMutation({
    mutationFn: () => adminApiRequest<AdminProductAttributeDto>(attribute ? `/api/admin/attributes/${encodeURIComponent(attribute.id)}` : '/api/admin/attributes', {
      method: attribute ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ groupId: groupId || null, code: code.trim().toUpperCase(), name: name.trim(), valueType, unitCode: unitCode.trim() || null, isFilterable, isSearchable, isRequiredDefault, sortOrder: Number(sortOrder) || 0, isActive }),
    }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'pim', 'attributes'] }); setOpen(false); },
  });
  const allowed = attribute ? canUpdate : canCreate;
  if (!allowed) return null;
  return (
    <ModalDialog description="نوع مقدار و قابلیت جست‌وجو/فیلتر در سرویس معتبرسازی می‌شوند؛ این فرم ستون ثابت محصول ایجاد نمی‌کند." onOpenChange={setOpen} open={open} title={attribute ? `ویرایش ویژگی ${attribute.name}` : 'افزودن ویژگی'} trigger={attribute ? <Button size="sm" variant="secondary"><Pencil aria-hidden="true" className="size-3.5" /> ویرایش</Button> : <Button><Plus aria-hidden="true" className="size-4" /> ویژگی جدید</Button>}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>نام ویژگی</span><Input disabled={save.isPending} maxLength={160} onChange={(event) => { const next = event.target.value; setName(next); if (!attribute) setCode(codeFromText(next)); }} required value={name} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>گروه</span><Select disabled={save.isPending || groups.isPending} onChange={(event) => setGroupId(event.target.value)} value={groupId}><option value="">بدون گروه</option>{(groups.data?.items ?? []).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>کد</span><Input disabled={save.isPending} maxLength={96} onChange={(event) => setCode(event.target.value.toUpperCase())} required value={code} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>نوع مقدار</span><Select disabled={save.isPending} onChange={(event) => setValueType(event.target.value as AdminProductAttributeDto['valueType'])} value={valueType}><option value="TEXT">متن</option><option value="NUMBER">عدد</option><option value="BOOLEAN">بله / خیر</option><option value="SELECT">انتخابی</option><option value="MULTI_SELECT">چندانتخابی</option><option value="DIMENSION">ابعاد</option></Select></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>واحد</span><Input disabled={save.isPending} maxLength={32} onChange={(event) => setUnitCode(event.target.value)} placeholder="GB، گرم، میلی‌متر" value={unitCode} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>ترتیب نمایش</span><Input disabled={save.isPending} onChange={(event) => setSortOrder(event.target.value)} type="number" value={sortOrder} /></label>
        </div>
        <div className="grid gap-2 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700 sm:grid-cols-2">
          <label className="flex items-center gap-2"><input checked={isFilterable} disabled={save.isPending} onChange={(event) => setIsFilterable(event.target.checked)} type="checkbox" /> قابل فیلتر</label>
          <label className="flex items-center gap-2"><input checked={isSearchable} disabled={save.isPending} onChange={(event) => setIsSearchable(event.target.checked)} type="checkbox" /> قابل جست‌وجو</label>
          <label className="flex items-center gap-2"><input checked={isRequiredDefault} disabled={save.isPending} onChange={(event) => setIsRequiredDefault(event.target.checked)} type="checkbox" /> پیش‌فرض اجباری</label>
          <label className="flex items-center gap-2"><input checked={isActive} disabled={save.isPending} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" /> فعال</label>
        </div>
        {groups.isError ? <Alert title="فهرست گروه‌ها دریافت نشد" tone="warning">ویژگی بدون گروه هم قابل ثبت است؛ برای دسته‌بندی دقیق‌تر اتصال سرویس گروه‌ها را بررسی کنید.</Alert> : null}
        <MutationError error={save.error} title="ذخیرهٔ ویژگی انجام نشد" />
        <div className="flex justify-end"><Button disabled={save.isPending} type="submit"><Save aria-hidden="true" className="size-4" /> {save.isPending ? 'در حال ذخیره…' : 'ذخیرهٔ ویژگی'}</Button></div>
      </form>
    </ModalDialog>
  );
}

function DeleteSpecificationAction({ canDelete, id, label, resource }: { canDelete: boolean; id: string; label: string; resource: 'specification-groups' | 'attributes' }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => adminApiRequest<{ deleted: boolean }>(`/api/admin/${resource}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'pim', resource] }),
  });
  if (!canDelete) return null;
  return <ConfirmDialog confirmLabel="حذف" destructive description="سرویس وابستگی‌های مشخصات و محصولات را پیش از حذف بررسی می‌کند." onConfirm={() => remove.mutate()} title={`حذف «${label}»`} trigger={<Button disabled={remove.isPending} size="sm" variant="danger"><Trash2 aria-hidden="true" className="size-3.5" /> حذف</Button>} />;
}

export function PimSpecificationCreateActions({ canCreate = false }: { canCreate?: boolean }) {
  if (!canCreate) return null;
  return <div className="flex flex-wrap gap-2"><SpecificationGroupEditor canCreate={canCreate} /><AttributeEditor canCreate={canCreate} /></div>;
}

export function PimSpecificationsManager({ canCreate = false, canDelete = false, canUpdate = false }: SpecificationPermissions) {
  const [groupPage, setGroupPage] = useState(1);
  const [groupQuery, setGroupQuery] = useState('');
  const [attributePage, setAttributePage] = useState(1);
  const [attributeQuery, setAttributeQuery] = useState('');
  const groups = usePimPage<AdminSpecificationGroupDto>('specification-groups', `/api/admin/specification-groups${pimQuery({ page: groupPage, pageSize: 25, query: useDebouncedValue(groupQuery) })}`);
  const attributes = usePimPage<AdminProductAttributeDto>('attributes', `/api/admin/attributes${pimQuery({ page: attributePage, pageSize: 25, query: useDebouncedValue(attributeQuery) })}`);
  const groupColumns: readonly DataTableColumn<AdminSpecificationGroupDto>[] = [
    { id: 'group', header: 'گروه', cell: (group) => <div><p className="font-semibold text-zinc-900">{group.name}</p><code className="mt-1 block text-xs text-zinc-500">{group.code}</code></div> },
    { id: 'attributeCount', header: 'ویژگی‌ها', cell: (group) => new Intl.NumberFormat('fa-IR').format(group.attributeCount) },
    { id: 'status', header: 'وضعیت', cell: (group) => <Badge tone={group.isActive ? 'success' : 'neutral'}>{activeStatusLabel(group.isActive)}</Badge> },
    { id: 'updatedAt', header: 'آخرین تغییر', cell: (group) => <time dateTime={group.updatedAt}>{formatPimDate(group.updatedAt)}</time> },
    { id: 'actions', header: 'عملیات', cell: (group) => <div className="flex flex-wrap gap-2"><SpecificationGroupEditor canUpdate={canUpdate} group={group} /><DeleteSpecificationAction canDelete={canDelete} id={group.id} label={group.name} resource="specification-groups" /></div> },
  ];
  const attributeColumns: readonly DataTableColumn<AdminProductAttributeDto>[] = [
    { id: 'attribute', header: 'ویژگی', cell: (attribute) => <div><p className="font-semibold text-zinc-900">{attribute.name}</p><code className="mt-1 block text-xs text-zinc-500">{attribute.code}</code></div> },
    { id: 'type', header: 'نوع', cell: (attribute) => <Badge tone="info">{attribute.valueType}</Badge> },
    { id: 'capabilities', header: 'قابلیت‌ها', cell: (attribute) => <div className="flex flex-wrap gap-1">{attribute.isFilterable ? <Badge>فیلتر</Badge> : null}{attribute.isSearchable ? <Badge>جست‌وجو</Badge> : null}{attribute.isRequiredDefault ? <Badge tone="warning">اجباری</Badge> : null}</div> },
    { id: 'values', header: 'مقادیر', cell: (attribute) => new Intl.NumberFormat('fa-IR').format(attribute.valueCount) },
    { id: 'status', header: 'وضعیت', cell: (attribute) => <Badge tone={attribute.isActive ? 'success' : 'neutral'}>{activeStatusLabel(attribute.isActive)}</Badge> },
    { id: 'actions', header: 'عملیات', cell: (attribute) => <div className="flex flex-wrap gap-2"><AttributeEditor attribute={attribute} canUpdate={canUpdate} /><DeleteSpecificationAction canDelete={canDelete} id={attribute.id} label={attribute.name} resource="attributes" /></div> },
  ];
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div><CardTitle>گروه‌های مشخصات</CardTitle><CardDescription>برای مرتب‌سازی اطلاعاتی مانند نمایشگر، دوربین و سخت‌افزار.</CardDescription></div><Layers3 aria-hidden="true" className="size-5 text-zinc-500" /></CardHeader>
        <CardContent><AdminCollectionPage columns={groupColumns} emptyDescription="گروهی برای سازمان‌دهی مشخصات ثبت نشده است." emptyTitle="گروه مشخصات وجود ندارد" filterLabel="فیلتر" getRowKey={(group) => group.id} isFetching={groups.isFetching} onPageChange={setGroupPage} onSearchChange={(next) => { setGroupQuery(next); setGroupPage(1); }} remoteFiltering searchPlaceholder="جست‌وجو با نام یا کد گروه" searchValue={groupQuery} state={toPimListState(groups)} /></CardContent>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>ویژگی‌ها و نوع مقدار</CardTitle><CardDescription>ساختار انعطاف‌پذیر برای مدل‌های متفاوت Apple، بدون ستون‌های سخت‌کد شده.</CardDescription></div><SlidersHorizontal aria-hidden="true" className="size-5 text-zinc-500" /></CardHeader>
        <CardContent><AdminCollectionPage columns={attributeColumns} emptyDescription="ویژگی‌ای برای ورود مشخصات محصول تعریف نشده است." emptyTitle="ویژگی مشخصات وجود ندارد" filterLabel="فیلتر" getRowKey={(attribute) => attribute.id} isFetching={attributes.isFetching} onPageChange={setAttributePage} onSearchChange={(next) => { setAttributeQuery(next); setAttributePage(1); }} remoteFiltering searchPlaceholder="جست‌وجو با نام یا کد ویژگی" searchValue={attributeQuery} state={toPimListState(attributes)} /></CardContent>
      </Card>
    </div>
  );
}
