'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { Select } from '@/components/ui/select';
import type { InventoryDeviceUnitDto } from '@/modules/inventory/types';
import { adminApiRequest } from '@/modules/admin/api-client';
import { useDebouncedValue } from '@/components/admin/admin-resource-query';

import { errorMessage, inventoryQuery, type InventoryPage } from './inventory-client';

function statusTone(status: InventoryDeviceUnitDto['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'AVAILABLE') return 'success';
  if (status === 'RESERVED') return 'warning';
  if (status === 'DAMAGED') return 'danger';
  return 'neutral';
}

function TrackingPolicyDialog({ canManage }: { canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [trackingMode, setTrackingMode] = useState<'NONE' | 'SERIAL' | 'IMEI' | 'SERIAL_AND_IMEI'>('IMEI');
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => adminApiRequest('/api/inventory/sku-policy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sku: sku.trim().toUpperCase(), trackingMode }) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['admin', 'inventory'] }); setOpen(false); },
  });
  if (!canManage) return null;
  return <ModalDialog open={open} onOpenChange={setOpen} title="سیاست رهگیری SKU" description="برای دریافت دستگاه‌های اپل، سیاست رهگیری باید پیش از ثبت رسید تعیین شود. شناسه‌های واقعی در این فهرست ماسک می‌شوند." trigger={<Button><ShieldCheck className="size-4" aria-hidden="true" />سیاست رهگیری</Button>}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><label className="block text-sm font-medium">کد SKU<Input dir="ltr" required value={sku} onChange={(event) => setSku(event.target.value)} /></label><label className="block text-sm font-medium">نوع رهگیری<Select value={trackingMode} onChange={(event) => setTrackingMode(event.target.value as typeof trackingMode)}><option value="NONE">بدون رهگیری</option><option value="SERIAL">سریال</option><option value="IMEI">IMEI</option><option value="SERIAL_AND_IMEI">IMEI و سریال</option></Select></label>{mutation.error ? <p className="text-sm text-red-700" role="alert">{errorMessage(mutation.error)}</p> : null}<div className="flex justify-end"><Button disabled={mutation.isPending} type="submit">ذخیره</Button></div></form></ModalDialog>;
}

export function DeviceUnitList({ canManage }: { canManage: boolean }) {
  const [sku, setSku] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const path = `/api/imei${inventoryQuery({ page: 1, pageSize: 50, sku: sku.trim().toUpperCase() || undefined, query: debouncedQuery || undefined, status })}`;
  const devices = useQuery({ queryKey: ['admin', 'inventory', 'imei', path], queryFn: () => adminApiRequest<InventoryPage<InventoryDeviceUnitDto>>(path) });
  const columns: readonly DataTableColumn<InventoryDeviceUnitDto>[] = [
    { id: 'sku', header: 'SKU', cell: (device) => <code>{device.skuCode}</code> },
    { id: 'imei', header: 'IMEI', cell: (device) => <code>{device.imeiMasked ?? '—'}</code> },
    { id: 'serial', header: 'سریال', cell: (device) => <code>{device.serialNumberMasked ?? '—'}</code> },
    { id: 'branch', header: 'شعبه', cell: (device) => device.branch?.name ?? '—' },
    { id: 'status', header: 'وضعیت', cell: (device) => <Badge tone={statusTone(device.status)}>{device.status}</Badge> },
    { id: 'warranty', header: 'گارانتی', cell: (device) => device.warrantyExpiresAt ? new Intl.DateTimeFormat('fa-IR').format(new Date(device.warrantyExpiresAt)) : '—' },
  ];
  return <div className="space-y-4"><div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-3 md:flex-row"><label className="flex-1 text-sm font-medium">SKU<Input dir="ltr" value={sku} onChange={(event) => setSku(event.target.value)} /></label><label className="flex-1 text-sm font-medium">جست‌وجوی شناسه<Input dir="ltr" minLength={3} value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="min-w-44 text-sm font-medium">وضعیت<Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">همه</option><option value="AVAILABLE">AVAILABLE</option><option value="RESERVED">RESERVED</option><option value="SOLD">SOLD</option><option value="RETURNED">RETURNED</option><option value="DAMAGED">DAMAGED</option></Select></label><div className="flex items-end"><TrackingPolicyDialog canManage={canManage} /></div></div><p className="text-xs leading-5 text-zinc-500">برای رعایت حریم خصوصی، IMEI و شمارهٔ سریال فقط به‌شکل ماسک‌شده نمایش داده می‌شوند و هرگز به ویترین فروشگاه ارسال نمی‌شوند.</p>{devices.isError ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage(devices.error)}</p> : null}<DataTable columns={columns} getRowKey={(device) => device.id} rows={devices.data?.items ?? []} emptyMessage={devices.isPending ? 'در حال دریافت دستگاه‌ها…' : 'دستگاه رهگیری‌شده‌ای پیدا نشد.'} /></div>;
}
