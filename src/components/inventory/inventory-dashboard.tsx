'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownUp, Boxes, ClipboardPlus, PackageCheck, RefreshCw, ScanLine, Warehouse } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { Select } from '@/components/ui/select';
import type { InventoryBranchDto, InventoryDashboardDto, InventoryItemDto, InventoryWarehouseDto } from '@/modules/inventory/types';
import { adminApiRequest } from '@/modules/admin/api-client';
import { useDebouncedValue } from '@/components/admin/admin-resource-query';

import { errorMessage, idempotencyKey, inventoryQuery, type InventoryPage, useInventoryPage } from './inventory-client';

type InventoryResponse = Readonly<{
  dashboard: InventoryDashboardDto;
  inventory: InventoryPage<InventoryItemDto>;
}>;

type LocationChoice = Readonly<{ id: string; label: string }>;

function availabilityTone(value: InventoryItemDto['availability']): 'success' | 'warning' | 'danger' {
  return value === 'AVAILABLE' ? 'success' : value === 'LIMITED' ? 'warning' : 'danger';
}

function locationsFromWarehouses(items: readonly InventoryWarehouseDto[] | undefined): readonly LocationChoice[] {
  return (items ?? []).flatMap((warehouse) => warehouse.locations.map((location) => ({
    id: location.id,
    label: `${warehouse.branch.name} / ${warehouse.name} / ${location.name}`,
  })));
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Boxes }) {
  return <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><span className="text-sm text-zinc-500">{label}</span><Icon aria-hidden="true" className="size-5 text-zinc-400" /></div><p className="mt-3 text-2xl font-bold text-zinc-950">{new Intl.NumberFormat('fa-IR').format(value)}</p></div>;
}

function StockOperationError({ error }: { error: unknown }) {
  const message = errorMessage(error);
  return message ? <p className="text-sm text-red-700" role="alert">{message}</p> : null;
}

function ReceiveDialog({ canReceive, locations }: { canReceive: boolean; locations: readonly LocationChoice[] }) {
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reference, setReference] = useState('');
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => adminApiRequest('/api/inventory/receive', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sku: sku.trim().toUpperCase(), toLocationId, quantity: Number(quantity), reference: reference.trim() || null, idempotencyKey: idempotencyKey() }) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['admin', 'inventory'] }); setOpen(false); },
  });
  if (!canReceive) return null;
  return <ModalDialog open={open} onOpenChange={setOpen} title="دریافت موجودی" description="رسید کالا یک حرکت غیرقابل‌حذف ثبت می‌کند؛ مقدار موجودی به‌طور مستقیم ویرایش نمی‌شود." trigger={<Button size="sm"><ClipboardPlus className="size-4" aria-hidden="true" />دریافت</Button>}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><label className="block text-sm font-medium">کد SKU<Input dir="ltr" required value={sku} onChange={(event) => setSku(event.target.value)} /></label><label className="block text-sm font-medium">موقعیت انبار<Select required value={toLocationId} onChange={(event) => setToLocationId(event.target.value)}><option value="">انتخاب کنید</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}</Select></label><label className="block text-sm font-medium">تعداد<Input required min="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label className="block text-sm font-medium">مرجع (اختیاری)<Input value={reference} onChange={(event) => setReference(event.target.value)} /></label><StockOperationError error={mutation.error} /><div className="flex justify-end"><Button disabled={mutation.isPending} type="submit">{mutation.isPending ? 'در حال ثبت…' : 'ثبت رسید'}</Button></div></form></ModalDialog>;
}

/** Receives one serial- or IMEI-tracked unit without displaying its raw identifier. */
function TrackedReceiveDialog({ canReceive, locations }: { canReceive: boolean; locations: readonly LocationChoice[] }) {
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [imei, setImei] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [warrantyExpiresAt, setWarrantyExpiresAt] = useState('');
  const [reference, setReference] = useState('');
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => {
      const normalizedImei = imei.trim();
      const normalizedSerialNumber = serialNumber.trim();
      if (!normalizedImei && !normalizedSerialNumber) {
        throw new Error('IMEI یا شماره سریال را وارد کنید.');
      }
      return adminApiRequest('/api/inventory/receive', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sku: sku.trim().toUpperCase(),
          toLocationId,
          quantity: 1,
          reference: reference.trim() || null,
          idempotencyKey: idempotencyKey(),
          devices: [{
            ...(normalizedImei ? { imei: normalizedImei } : {}),
            ...(normalizedSerialNumber ? { serialNumber: normalizedSerialNumber } : {}),
            ...(warrantyExpiresAt ? { warrantyExpiresAt: new Date(`${warrantyExpiresAt}T00:00:00.000Z`).toISOString() } : {}),
          }],
        }),
      });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      setOpen(false);
      setImei('');
      setSerialNumber('');
      setWarrantyExpiresAt('');
      setReference('');
    },
  });
  if (!canReceive) return null;
  return <ModalDialog open={open} onOpenChange={setOpen} title="ثبت دستگاه رهگیری‌شده" description="یک دستگاه را با IMEI و/یا شماره سریال ثبت کنید. سرور سیاست رهگیری SKU را اعمال می‌کند و شناسهٔ خام در فهرست‌های عملیاتی ماسک می‌ماند." trigger={<Button size="sm" variant="secondary"><ScanLine className="size-4" aria-hidden="true" />ثبت دستگاه</Button>}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><label className="block text-sm font-medium">کد SKU<Input dir="ltr" required value={sku} onChange={(event) => setSku(event.target.value)} /></label><label className="block text-sm font-medium">موقعیت انبار<Select required value={toLocationId} onChange={(event) => setToLocationId(event.target.value)}><option value="">یک موقعیت انتخاب کنید</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}</Select></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">IMEI<Input dir="ltr" inputMode="numeric" value={imei} onChange={(event) => setImei(event.target.value)} /></label><label className="block text-sm font-medium">شماره سریال<Input dir="ltr" value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} /></label></div><label className="block text-sm font-medium">پایان گارانتی (اختیاری)<Input type="date" value={warrantyExpiresAt} onChange={(event) => setWarrantyExpiresAt(event.target.value)} /></label><label className="block text-sm font-medium">مرجع (اختیاری)<Input value={reference} onChange={(event) => setReference(event.target.value)} /></label><StockOperationError error={mutation.error} /><div className="flex justify-end"><Button disabled={mutation.isPending} type="submit">{mutation.isPending ? 'در حال ثبت…' : 'ثبت دستگاه'}</Button></div></form></ModalDialog>;
}

function AdjustDialog({ canAdjust, locations }: { canAdjust: boolean; locations: readonly LocationChoice[] }) {
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [locationId, setLocationId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [reason, setReason] = useState('');
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => adminApiRequest('/api/inventory/adjust', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sku: sku.trim().toUpperCase(), locationId, quantity: Number(quantity), direction, reason: reason.trim(), idempotencyKey: idempotencyKey() }) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['admin', 'inventory'] }); setOpen(false); },
  });
  if (!canAdjust) return null;
  return <ModalDialog open={open} onOpenChange={setOpen} title="اصلاح موجودی" description="هر افزایش یا کاهش، دلیل، کاربر و وضعیت قبل/بعد در لاگ ممیزی ثبت می‌شود." trigger={<Button size="sm" variant="secondary"><PackageCheck className="size-4" aria-hidden="true" />اصلاح</Button>}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><label className="block text-sm font-medium">کد SKU<Input dir="ltr" required value={sku} onChange={(event) => setSku(event.target.value)} /></label><label className="block text-sm font-medium">موقعیت<Select required value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">انتخاب کنید</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}</Select></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">جهت<Select value={direction} onChange={(event) => setDirection(event.target.value as 'INCREASE' | 'DECREASE')}><option value="INCREASE">افزایش</option><option value="DECREASE">کاهش</option></Select></label><label className="block text-sm font-medium">تعداد<Input required min="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label></div><label className="block text-sm font-medium">دلیل<Input required value={reason} onChange={(event) => setReason(event.target.value)} /></label><StockOperationError error={mutation.error} /><div className="flex justify-end"><Button disabled={mutation.isPending} type="submit">ثبت اصلاح</Button></div></form></ModalDialog>;
}

function TransferDialog({ canTransfer, locations }: { canTransfer: boolean; locations: readonly LocationChoice[] }) {
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => adminApiRequest('/api/inventory/transfer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sku: sku.trim().toUpperCase(), fromLocationId, toLocationId, quantity: Number(quantity), idempotencyKey: idempotencyKey() }) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['admin', 'inventory'] }); setOpen(false); },
  });
  if (!canTransfer) return null;
  return <ModalDialog open={open} onOpenChange={setOpen} title="انتقال موجودی" description="انتقال بین موقعیت‌ها در یک تراکنش اتمیک و با یک سند حرکت ثبت می‌شود." trigger={<Button size="sm" variant="secondary"><ArrowDownUp className="size-4" aria-hidden="true" />انتقال</Button>}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><label className="block text-sm font-medium">کد SKU<Input dir="ltr" required value={sku} onChange={(event) => setSku(event.target.value)} /></label><label className="block text-sm font-medium">مبدا<Select required value={fromLocationId} onChange={(event) => setFromLocationId(event.target.value)}><option value="">انتخاب کنید</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}</Select></label><label className="block text-sm font-medium">مقصد<Select required value={toLocationId} onChange={(event) => setToLocationId(event.target.value)}><option value="">انتخاب کنید</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}</Select></label><label className="block text-sm font-medium">تعداد<Input required min="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><StockOperationError error={mutation.error} /><div className="flex justify-end"><Button disabled={mutation.isPending} type="submit">ثبت انتقال</Button></div></form></ModalDialog>;
}

export function InventoryDashboard({ permissions }: { permissions: ReadonlySet<string> }) {
  const [branchId, setBranchId] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [availability, setAvailability] = useState('');
  const debouncedSku = useDebouncedValue(sku);
  const query = inventoryQuery({ page: 1, pageSize: 50, branchId, sku: debouncedSku.trim().toUpperCase() || undefined, categoryId, availability });
  const data = useQuery({ queryKey: ['admin', 'inventory', 'dashboard', query], queryFn: () => adminApiRequest<InventoryResponse>(`/api/inventory${query}`) });
  const branches = useInventoryPage<InventoryBranchDto>('branches-options', '/api/branches?page=1&pageSize=100');
  const warehouses = useInventoryPage<InventoryWarehouseDto>('warehouses-options', '/api/warehouses?page=1&pageSize=100');
  const locations = useMemo(() => locationsFromWarehouses(warehouses.data?.items), [warehouses.data?.items]);
  const columns: readonly DataTableColumn<InventoryItemDto>[] = [
    { id: 'sku', header: 'کالا', cell: (item) => <div><p className="font-semibold text-zinc-900">{item.sku.productName}</p><code className="text-xs text-zinc-500">{item.sku.code}</code></div> },
    { id: 'branch', header: 'شعبه / انبار', cell: (item) => <div><p>{item.branch.name}</p><p className="text-xs text-zinc-500">{item.warehouse.name} · {item.location.name}</p></div> },
    { id: 'stock', header: 'موجودی', cell: (item) => <span>{new Intl.NumberFormat('fa-IR').format(item.quantity)}</span> },
    { id: 'reserved', header: 'رزرو', cell: (item) => <span>{new Intl.NumberFormat('fa-IR').format(item.reservedQuantity)}</span> },
    { id: 'available', header: 'قابل تخصیص', cell: (item) => <Badge tone={availabilityTone(item.availability)}>{item.availability === 'AVAILABLE' ? 'موجود' : item.availability === 'LIMITED' ? 'محدود' : 'ناموجود'}</Badge> },
    { id: 'tracking', header: 'رهگیری', cell: (item) => <code className="text-xs">{item.trackingMode}</code> },
  ];
  const dashboard = data.data?.dashboard;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {dashboard ? <>
          <Metric label="کل موجودی" value={dashboard.totalQuantity} icon={Boxes} />
          <Metric label="قابل تخصیص" value={dashboard.availableQuantity} icon={PackageCheck} />
          <Metric label="رزرو شده" value={dashboard.reservedQuantity} icon={ClipboardPlus} />
          <Metric label="موجودی آسیب‌دیده" value={dashboard.damagedQuantity} icon={Warehouse} />
        </> : <>
          <div className="h-28 rounded-2xl bg-zinc-100" />
          <div className="h-28 rounded-2xl bg-zinc-100" />
          <div className="h-28 rounded-2xl bg-zinc-100" />
          <div className="h-28 rounded-2xl bg-zinc-100" />
        </>}
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium">شعبه<Select value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">همهٔ شعب</option>{branches.data?.items.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></label>
          <label className="text-sm font-medium">SKU<Input dir="ltr" value={sku} onChange={(event) => setSku(event.target.value)} placeholder="IPHONE-…" /></label>
          <label className="text-sm font-medium">شناسهٔ دسته<Input dir="ltr" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} placeholder="cuid" /></label>
          <label className="text-sm font-medium">وضعیت<Select value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="">همهٔ وضعیت‌ها</option><option value="AVAILABLE">موجود</option><option value="LIMITED">محدود</option><option value="UNAVAILABLE">ناموجود</option></Select></label>
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => void data.refetch()}><RefreshCw className="size-4" aria-hidden="true" />به‌روزرسانی</Button>
          <ReceiveDialog canReceive={permissions.has('inventory.receive')} locations={locations} />
          <TrackedReceiveDialog canReceive={permissions.has('inventory.receive')} locations={locations} />
          <AdjustDialog canAdjust={permissions.has('inventory.adjust')} locations={locations} />
          <TransferDialog canTransfer={permissions.has('inventory.transfer')} locations={locations} />
        </div>
      </div>
      {data.isError ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">دریافت موجودی ممکن نشد: {errorMessage(data.error)}</p> : null}
      <DataTable columns={columns} getRowKey={(item) => item.id} rows={data.data?.inventory.items ?? []} emptyMessage={data.isPending ? 'در حال دریافت موجودی…' : 'برای این فیلتر هیچ موجودی ثبت نشده است.'} />
    </div>
  );
}
