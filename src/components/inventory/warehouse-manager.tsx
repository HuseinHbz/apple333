'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { Select } from '@/components/ui/select';
import type { InventoryBranchDto, InventoryWarehouseDto } from '@/modules/inventory/types';
import { adminApiRequest } from '@/modules/admin/api-client';

import { errorMessage, useInventoryPage } from './inventory-client';

function WarehouseEditor({ warehouse, branches, canCreate, canUpdate }: { warehouse?: InventoryWarehouseDto; branches: readonly InventoryBranchDto[]; canCreate?: boolean; canUpdate?: boolean }) {
  const canUse = warehouse ? canUpdate : canCreate;
  const [open, setOpen] = useState(false);
  const [branchId, setBranchId] = useState(warehouse?.branchId ?? '');
  const [code, setCode] = useState(warehouse?.code ?? '');
  const [name, setName] = useState(warehouse?.name ?? '');
  const [status, setStatus] = useState<InventoryWarehouseDto['status']>(warehouse?.status ?? 'ACTIVE');
  const [locationCode, setLocationCode] = useState('MAIN');
  const [locationName, setLocationName] = useState('Main storage');
  const [locationType, setLocationType] = useState<'RECEIVING' | 'STORAGE' | 'PICKUP' | 'QUARANTINE' | 'DAMAGED'>('STORAGE');
  const client = useQueryClient();
  useEffect(() => { if (open) { setBranchId(warehouse?.branchId ?? ''); setCode(warehouse?.code ?? ''); setName(warehouse?.name ?? ''); setStatus(warehouse?.status ?? 'ACTIVE'); } }, [open, warehouse]);
  const mutation = useMutation({
    mutationFn: () => adminApiRequest<InventoryWarehouseDto>(warehouse ? `/api/warehouses/${encodeURIComponent(warehouse.id)}` : '/api/warehouses', { method: warehouse ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(warehouse ? { code: code.trim().toUpperCase(), name: name.trim(), status } : { branchId, code: code.trim().toUpperCase(), name: name.trim(), status, locations: [{ code: locationCode.trim().toUpperCase(), name: locationName.trim(), type: locationType, status: 'ACTIVE' }] }) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['admin', 'inventory', 'warehouses'] }); setOpen(false); },
  });
  if (!canUse) return null;
  return <ModalDialog open={open} onOpenChange={setOpen} title={warehouse ? `ویرایش ${warehouse.name}` : 'انبار جدید'} description="هر انبار باید دست‌کم یک موقعیت فیزیکی داشته باشد. حذف فیزیکی انبار در این فاز مجاز نیست." trigger={warehouse ? <Button size="sm" variant="secondary"><Pencil className="size-3.5" aria-hidden="true" />ویرایش</Button> : <Button><Plus className="size-4" aria-hidden="true" />انبار جدید</Button>}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><div className="grid gap-3 sm:grid-cols-2">{warehouse ? null : <label className="text-sm font-medium">شعبه<Select required value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">انتخاب کنید</option>{branches.filter((branch) => branch.status === 'ACTIVE').map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></label>}<label className="text-sm font-medium">نام<Input required value={name} onChange={(event) => setName(event.target.value)} /></label><label className="text-sm font-medium">کد<Input dir="ltr" required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /></label><label className="text-sm font-medium">وضعیت<Select value={status} onChange={(event) => setStatus(event.target.value as InventoryWarehouseDto['status'])}><option value="ACTIVE">فعال</option><option value="DISABLED">غیرفعال</option><option value="ARCHIVED">بایگانی</option></Select></label></div>{warehouse ? null : <div className="rounded-xl border border-zinc-200 p-3"><p className="mb-3 text-sm font-semibold">اولین موقعیت انبار</p><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-medium">نام<Input required value={locationName} onChange={(event) => setLocationName(event.target.value)} /></label><label className="text-sm font-medium">کد<Input dir="ltr" required value={locationCode} onChange={(event) => setLocationCode(event.target.value.toUpperCase())} /></label><label className="text-sm font-medium">نوع<Select value={locationType} onChange={(event) => setLocationType(event.target.value as typeof locationType)}><option value="STORAGE">نگهداری</option><option value="RECEIVING">دریافت</option><option value="PICKUP">تحویل</option><option value="QUARANTINE">قرنطینه</option><option value="DAMAGED">آسیب‌دیده</option></Select></label></div></div>}{mutation.error ? <p className="text-sm text-red-700" role="alert">{errorMessage(mutation.error)}</p> : null}<div className="flex justify-end"><Button disabled={mutation.isPending} type="submit">{mutation.isPending ? 'در حال ذخیره…' : 'ذخیره'}</Button></div></form></ModalDialog>;
}

export function WarehouseManager({ canCreate, canUpdate }: { canCreate: boolean; canUpdate: boolean }) {
  const warehouses = useInventoryPage<InventoryWarehouseDto>('warehouses', '/api/warehouses?page=1&pageSize=100');
  const branches = useInventoryPage<InventoryBranchDto>('branches-options', '/api/branches?page=1&pageSize=100');
  const columns: readonly DataTableColumn<InventoryWarehouseDto>[] = [
    { id: 'warehouse', header: 'انبار', cell: (warehouse) => <div><p className="font-semibold text-zinc-900">{warehouse.name}</p><code className="text-xs text-zinc-500">{warehouse.code}</code></div> },
    { id: 'branch', header: 'شعبه', cell: (warehouse) => warehouse.branch.name },
    { id: 'locations', header: 'موقعیت‌ها', cell: (warehouse) => <div className="flex flex-wrap gap-1">{warehouse.locations.map((location) => <Badge key={location.id} tone="neutral">{location.code}</Badge>)}</div> },
    { id: 'status', header: 'وضعیت', cell: (warehouse) => <Badge tone={warehouse.status === 'ACTIVE' ? 'success' : warehouse.status === 'DISABLED' ? 'warning' : 'neutral'}>{warehouse.status}</Badge> },
    { id: 'actions', header: 'عملیات', cell: (warehouse) => <WarehouseEditor warehouse={warehouse} branches={branches.data?.items ?? []} canUpdate={canUpdate} /> },
  ];
  return <div className="space-y-4"><div className="flex justify-end"><WarehouseEditor branches={branches.data?.items ?? []} canCreate={canCreate} /></div>{warehouses.isError ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage(warehouses.error)}</p> : null}<DataTable columns={columns} getRowKey={(warehouse) => warehouse.id} rows={warehouses.data?.items ?? []} emptyMessage={warehouses.isPending ? 'در حال دریافت انبارها…' : 'انبار ثبت نشده است.'} /></div>;
}
