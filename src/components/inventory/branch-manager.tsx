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
import type { InventoryBranchDto } from '@/modules/inventory/types';
import { adminApiRequest } from '@/modules/admin/api-client';

import { errorMessage, type InventoryPage, useInventoryPage } from './inventory-client';

type BranchDraft = Readonly<{
  code: string;
  name: string;
  kind: 'STORE' | 'CENTRAL_STOCK';
  status: 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
  city: string;
  address: string;
  phone: string;
  isPickupEnabled: boolean;
}>;

function draftFor(branch?: InventoryBranchDto): BranchDraft {
  return {
    code: branch?.code ?? '', name: branch?.name ?? '', kind: branch?.kind ?? 'STORE', status: branch?.status ?? 'ACTIVE', city: branch?.city ?? '', address: branch?.address ?? '', phone: branch?.phone ?? '', isPickupEnabled: branch?.isPickupEnabled ?? true,
  };
}

function statusTone(status: InventoryBranchDto['status']): 'success' | 'warning' | 'neutral' {
  return status === 'ACTIVE' ? 'success' : status === 'DISABLED' ? 'warning' : 'neutral';
}

function BranchEditor({ branch, canCreate, canUpdate }: { branch?: InventoryBranchDto; canCreate?: boolean; canUpdate?: boolean }) {
  const canUse = branch ? canUpdate : canCreate;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BranchDraft>(() => draftFor(branch));
  const client = useQueryClient();
  useEffect(() => { if (open) setDraft(draftFor(branch)); }, [branch, open]);
  const mutation = useMutation({
    mutationFn: () => adminApiRequest<InventoryBranchDto>(branch ? `/api/branches/${encodeURIComponent(branch.id)}` : '/api/branches', { method: branch ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...draft, code: draft.code.trim().toUpperCase(), name: draft.name.trim(), city: draft.city.trim() || null, address: draft.address.trim() || null, phone: draft.phone.trim() || null }) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['admin', 'inventory', 'branches'] }); setOpen(false); },
  });
  if (!canUse) return null;
  return <ModalDialog open={open} onOpenChange={setOpen} title={branch ? `ویرایش ${branch.name}` : 'شعبهٔ جدید'} description="کد شعبه ثابت و یکتا است. غیرفعال‌سازی، موجودی تاریخی را حذف نمی‌کند." trigger={branch ? <Button size="sm" variant="secondary"><Pencil className="size-3.5" aria-hidden="true" />ویرایش</Button> : <Button><Plus className="size-4" aria-hidden="true" />شعبهٔ جدید</Button>}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">نام<Input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label className="text-sm font-medium">کد<Input dir="ltr" required value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} /></label><label className="text-sm font-medium">نوع<Select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as BranchDraft['kind'] })}><option value="STORE">فروشگاه</option><option value="CENTRAL_STOCK">انبار مرکزی</option></Select></label><label className="text-sm font-medium">وضعیت<Select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as BranchDraft['status'] })}><option value="ACTIVE">فعال</option><option value="DISABLED">غیرفعال</option><option value="ARCHIVED">بایگانی</option></Select></label><label className="text-sm font-medium">شهر<Input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} /></label><label className="text-sm font-medium">تلفن<Input dir="ltr" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label></div><label className="block text-sm font-medium">نشانی<Input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isPickupEnabled} onChange={(event) => setDraft({ ...draft, isPickupEnabled: event.target.checked })} />تحویل حضوری فعال باشد</label>{mutation.error ? <p className="text-sm text-red-700" role="alert">{errorMessage(mutation.error)}</p> : null}<div className="flex justify-end"><Button disabled={mutation.isPending} type="submit">{mutation.isPending ? 'در حال ذخیره…' : 'ذخیره'}</Button></div></form></ModalDialog>;
}

export function BranchManager({ canCreate, canUpdate }: { canCreate: boolean; canUpdate: boolean }) {
  const branches = useInventoryPage<InventoryBranchDto>('branches', '/api/branches?page=1&pageSize=100');
  const columns: readonly DataTableColumn<InventoryBranchDto>[] = [
    { id: 'name', header: 'شعبه', cell: (branch) => <div><p className="font-semibold text-zinc-900">{branch.name}</p><code className="text-xs text-zinc-500">{branch.code}</code></div> },
    { id: 'kind', header: 'نوع', cell: (branch) => branch.kind === 'STORE' ? 'فروشگاه' : 'انبار مرکزی' },
    { id: 'location', header: 'موقعیت', cell: (branch) => branch.city ?? '—' },
    { id: 'warehouses', header: 'انبارها', cell: (branch) => new Intl.NumberFormat('fa-IR').format(branch.warehouseCount) },
    { id: 'status', header: 'وضعیت', cell: (branch) => <Badge tone={statusTone(branch.status)}>{branch.status}</Badge> },
    { id: 'actions', header: 'عملیات', cell: (branch) => <BranchEditor branch={branch} canUpdate={canUpdate} /> },
  ];
  return <div className="space-y-4"><div className="flex justify-end"><BranchEditor canCreate={canCreate} /></div>{branches.isError ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage(branches.error)}</p> : null}<DataTable columns={columns} getRowKey={(branch) => branch.id} rows={branches.data?.items ?? []} emptyMessage={branches.isPending ? 'در حال دریافت شعب…' : 'شعبه‌ای ثبت نشده است.'} /></div>;
}
