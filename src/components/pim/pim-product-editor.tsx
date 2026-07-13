'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, CheckCircle2, ImagePlus, PackagePlus, Pencil, Plus, Save, Send, Sparkles, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAdminResourceQuery } from '@/components/admin/admin-resource-query';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { DataTableColumn } from '@/components/ui/data-table';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { adminApiRequest } from '@/modules/admin/api-client';
import type {
  AdminBrandDto,
  AdminCategoryDto,
  AdminProductAttributeDto,
  AdminProductDetailDto,
  AdminProductMediaDto,
  AdminProductSpecificationDto,
  AdminProductVariantDto,
  AdminWarrantyDto,
} from '@/modules/pim/types';
import { usePimPage } from './pim-resource-query';
import { errorText, formatPimDate, formatRials, productStatusLabel, productStatusTone as productStatusToneValue, slugFromName } from './pim-utils';

type ProductPermissions = Readonly<{
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  canPublish?: boolean;
}>;

type ProductFormValues = Readonly<{
  categoryId: string;
  brandId: string;
  name: string;
  slug: string;
  summary: string;
  description: string;
  isFeatured: boolean;
  featuredRank: string;
  isNew: boolean;
  isOnSale: boolean;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  noIndex: boolean;
  schemaDataText: string;
}>;

const emptyForm: ProductFormValues = {
  categoryId: '',
  brandId: '',
  name: '',
  slug: '',
  summary: '',
  description: '',
  isFeatured: false,
  featuredRank: '',
  isNew: false,
  isOnSale: false,
  metaTitle: '',
  metaDescription: '',
  canonicalUrl: '',
  noIndex: false,
  schemaDataText: '',
};

const productStatusTone = (status: Parameters<typeof productStatusToneValue>[0]) => productStatusToneValue(status) ?? 'neutral';

function formFromProduct(product: AdminProductDetailDto): ProductFormValues {
  return {
    categoryId: product.category?.id ?? '',
    brandId: product.brand?.id ?? '',
    name: product.name,
    slug: product.slug,
    summary: product.summary ?? '',
    description: product.description ?? '',
    isFeatured: product.isFeatured,
    featuredRank: product.featuredRank === null ? '' : String(product.featuredRank),
    isNew: product.isNew,
    isOnSale: product.isOnSale,
    metaTitle: product.seo?.metaTitle ?? '',
    metaDescription: product.seo?.metaDescription ?? '',
    canonicalUrl: product.seo?.canonicalUrl ?? '',
    noIndex: product.seo?.noIndex ?? false,
    schemaDataText: product.seo?.schemaData ? JSON.stringify(product.seo.schemaData, null, 2) : '',
  };
}

function ProductEditorForm({
  canCreate = false,
  canUpdate = false,
  product,
}: ProductPermissions & { product?: AdminProductDetailDto }) {
  const isCreate = product === undefined;
  const [values, setValues] = useState<ProductFormValues>(product ? formFromProduct(product) : emptyForm);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const brands = usePimPage<AdminBrandDto>('brands-options', '/api/admin/brands?page=1&pageSize=100');
  const categories = usePimPage<AdminCategoryDto>('categories-options', '/api/admin/categories?page=1&pageSize=100');

  useEffect(() => {
    setValues(product ? formFromProduct(product) : emptyForm);
    setSchemaError(null);
  }, [product]);

  const update = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
  const save = useMutation({
    mutationFn: async () => {
      let schemaData: Record<string, unknown> | null = null;
      if (values.schemaDataText.trim()) {
        try {
          const parsed = JSON.parse(values.schemaDataText) as unknown;
          if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('OBJECT_REQUIRED');
          schemaData = parsed as Record<string, unknown>;
          setSchemaError(null);
        } catch {
          setSchemaError('دادهٔ ساخت‌یافته باید یک شیء JSON معتبر باشد.');
          throw new Error('INVALID_PRODUCT_SCHEMA_JSON');
        }
      }
      const payload = {
        categoryId: values.categoryId || null,
        brandId: values.brandId || null,
        slug: values.slug.trim().toLowerCase(),
        name: values.name.trim(),
        summary: values.summary.trim() || null,
        description: values.description.trim() || null,
        isFeatured: values.isFeatured,
        featuredRank: values.featuredRank === '' ? null : Number(values.featuredRank),
        isNew: values.isNew,
        isOnSale: values.isOnSale,
        seo: {
          metaTitle: values.metaTitle.trim() || null,
          metaDescription: values.metaDescription.trim() || null,
          canonicalUrl: values.canonicalUrl.trim() || null,
          noIndex: values.noIndex,
          schemaData,
        },
      };
      if (isCreate) {
        return adminApiRequest<AdminProductDetailDto>('/api/admin/products', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
        });
      }
      return adminApiRequest<AdminProductDetailDto>(`/api/admin/products/${encodeURIComponent(product.id)}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, version: product.version }),
      });
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'pim', 'products'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'product', product?.id] });
      if (isCreate) router.replace(`/admin/products/${encodeURIComponent(saved.id)}`);
      else router.refresh();
    },
  });

  const allowed = isCreate ? canCreate : canUpdate;
  if (!allowed) {
    return <Alert title="ویرایش محصول مجاز نیست" tone="warning">شما مجوز لازم برای ایجاد یا تغییر این محصول را ندارید.</Alert>;
  }
  return (
    <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <Card>
        <CardHeader><div><CardTitle>هویت محصول</CardTitle><CardDescription>نام، اسلاگ، برند و دسته، پایهٔ جست‌وجو و URL محصول هستند.</CardDescription></div><PackagePlus aria-hidden="true" className="size-5 text-zinc-500" /></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>نام محصول</span><Input disabled={save.isPending} maxLength={220} onChange={(event) => { const name = event.target.value; update('name', name); if (isCreate) update('slug', slugFromName(name)); }} required value={values.name} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>اسلاگ</span><Input dir="ltr" disabled={save.isPending} maxLength={160} onChange={(event) => update('slug', event.target.value.toLowerCase())} required value={values.slug} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>برند</span><Select disabled={save.isPending || brands.isPending} onChange={(event) => update('brandId', event.target.value)} value={values.brandId}><option value="">بدون برند</option>{(brands.data?.items ?? []).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</Select></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>دسته</span><Select disabled={save.isPending || categories.isPending} onChange={(event) => update('categoryId', event.target.value)} value={values.categoryId}><option value="">بدون دسته</option>{(categories.data?.items ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></label>
          <label className="block space-y-1.5 text-sm font-medium text-zinc-700 md:col-span-2"><span>خلاصهٔ کوتاه</span><textarea className="min-h-20 w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100" disabled={save.isPending} maxLength={1000} onChange={(event) => update('summary', event.target.value)} value={values.summary} /></label>
          <label className="block space-y-1.5 text-sm font-medium text-zinc-700 md:col-span-2"><span>توضیحات کامل</span><textarea className="min-h-44 w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100" disabled={save.isPending} maxLength={20_000} onChange={(event) => update('description', event.target.value)} value={values.description} /></label>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>نمایش و فروش</CardTitle><CardDescription>این پرچم‌ها فقط دادهٔ محصول را تعریف می‌کنند؛ قیمت و موجودی در تنوع‌ها و انبار مدیریت می‌شود.</CardDescription></div><Sparkles aria-hidden="true" className="size-5 text-zinc-500" /></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>رتبهٔ ویژه</span><Input disabled={save.isPending || !values.isFeatured} min="0" onChange={(event) => update('featuredRank', event.target.value)} placeholder="اختیاری" type="number" value={values.featuredRank} /></label>
          <div className="grid gap-2 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700 sm:grid-cols-3 md:col-span-2">
            <label className="flex items-center gap-2"><input checked={values.isFeatured} disabled={save.isPending} onChange={(event) => update('isFeatured', event.target.checked)} type="checkbox" /> ویژه</label>
            <label className="flex items-center gap-2"><input checked={values.isNew} disabled={save.isPending} onChange={(event) => update('isNew', event.target.checked)} type="checkbox" /> محصول جدید</label>
            <label className="flex items-center gap-2"><input checked={values.isOnSale} disabled={save.isPending} onChange={(event) => update('isOnSale', event.target.checked)} type="checkbox" /> دارای تخفیف</label>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>SEO و دادهٔ ساخت‌یافته</CardTitle><CardDescription>اطلاعات این بخش در سرویس اعتبارسنجی و برای خروجی SEO محصول نگهداری می‌شود.</CardDescription></div></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>عنوان متا</span><Input disabled={save.isPending} maxLength={70} onChange={(event) => update('metaTitle', event.target.value)} value={values.metaTitle} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>Canonical URL</span><Input dir="ltr" disabled={save.isPending} maxLength={2048} onChange={(event) => update('canonicalUrl', event.target.value)} placeholder="https://apple333.ir/..." type="url" value={values.canonicalUrl} /></label>
          <label className="block space-y-1.5 text-sm font-medium text-zinc-700 md:col-span-2"><span>توضیح متا</span><textarea className="min-h-20 w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100" disabled={save.isPending} maxLength={170} onChange={(event) => update('metaDescription', event.target.value)} value={values.metaDescription} /></label>
          <label className="block space-y-1.5 text-sm font-medium text-zinc-700 md:col-span-2"><span>Schema JSON (اختیاری)</span><textarea className="min-h-32 w-full rounded-xl border border-zinc-200 p-3 font-mono text-xs outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100" dir="ltr" disabled={save.isPending} onChange={(event) => update('schemaDataText', event.target.value)} value={values.schemaDataText} /></label>
          <label className="flex items-center gap-2 text-sm text-zinc-700"><input checked={values.noIndex} disabled={save.isPending} onChange={(event) => update('noIndex', event.target.checked)} type="checkbox" /> از ایندکس‌شدن این محصول جلوگیری شود</label>
        </CardContent>
      </Card>
      {schemaError ? <Alert title="Schema JSON نامعتبر است" tone="danger">{schemaError}</Alert> : null}
      {save.isError ? <Alert title="ذخیرهٔ محصول انجام نشد" tone="danger">{errorText(save.error)}</Alert> : null}
      {(brands.isError || categories.isError) ? <Alert title="فهرست مرجع به‌طور کامل در دسترس نیست" tone="warning">می‌توانید فیلدهای دیگر را ویرایش کنید؛ برای اتصال برند یا دسته، سرویس‌های مرجع را بررسی کنید.</Alert> : null}
      <div className="flex justify-end"><Button disabled={save.isPending} type="submit"><Save aria-hidden="true" className="size-4" /> {save.isPending ? 'در حال ذخیره…' : isCreate ? 'ایجاد محصول' : 'ذخیرهٔ تغییرات'}</Button></div>
    </form>
  );
}

function WorkflowActions({ canPublish = false, canUpdate = false, product }: ProductPermissions & { product: AdminProductDetailDto }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const workflow = useMutation({
    mutationFn: async (action: 'submit-review' | 'publish' | 'archive') => adminApiRequest<AdminProductDetailDto>(`/api/admin/products/${encodeURIComponent(product.id)}/${action}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: product.version }),
    }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'pim', 'products'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'product', product.id] });
    },
    onError: (cause) => setError(errorText(cause)),
  });
  return (
    <Card>
      <CardHeader><div><CardTitle>گردش‌کار انتشار</CardTitle><CardDescription>تغییر وضعیت تنها از مسیرهای کنترل‌شدهٔ سرویس و با نسخهٔ هم‌زمان محصول انجام می‌شود.</CardDescription></div><Badge tone={productStatusTone(product.status)}>{productStatusLabel(product.status)}</Badge></CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        {canUpdate && product.status === 'DRAFT' ? <Button disabled={workflow.isPending} onClick={() => workflow.mutate('submit-review')} variant="secondary"><Send aria-hidden="true" className="size-4" /> ارسال برای بررسی</Button> : null}
        {canPublish && product.status === 'REVIEW' ? <Button disabled={workflow.isPending} onClick={() => workflow.mutate('publish')}><CheckCircle2 aria-hidden="true" className="size-4" /> انتشار محصول</Button> : null}
        {canUpdate && product.status !== 'ARCHIVED' ? <Button disabled={workflow.isPending} onClick={() => workflow.mutate('archive')} variant="secondary"><Archive aria-hidden="true" className="size-4" /> بایگانی</Button> : null}
        {workflow.isPending ? <span className="text-xs text-zinc-500">در حال اعمال گردش‌کار…</span> : null}
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </CardContent>
    </Card>
  );
}

function VariantEditor({ canCreate = false, canUpdate = false, productId, variant }: { canCreate?: boolean; canUpdate?: boolean; productId: string; variant?: AdminProductVariantDto }) {
  const [open, setOpen] = useState(false);
  const [skuCode, setSkuCode] = useState(variant?.skuRecord?.code ?? variant?.sku ?? '');
  const [barcode, setBarcode] = useState(variant?.skuRecord?.barcode ?? '');
  const [title, setTitle] = useState(variant?.title ?? '');
  const [color, setColor] = useState(variant?.color ?? '');
  const [storage, setStorage] = useState(variant?.storage ?? '');
  const [region, setRegion] = useState(variant?.region ?? '');
  const [modelNumber, setModelNumber] = useState(variant?.modelNumber ?? '');
  const [warrantyId, setWarrantyId] = useState(variant?.warranty?.id ?? '');
  const [priceRials, setPriceRials] = useState(variant?.skuRecord?.priceRials ?? '0');
  const [compareAtPriceRials, setCompareAtPriceRials] = useState(variant?.skuRecord?.compareAtPriceRials ?? '');
  const [costRials, setCostRials] = useState(variant?.skuRecord?.costRials ?? '');
  const [status, setStatus] = useState<NonNullable<AdminProductVariantDto['skuRecord']>['status']>(variant?.skuRecord?.status ?? 'ACTIVE');
  const [isActive, setIsActive] = useState(variant?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(String(variant?.sortOrder ?? 0));
  const warranties = usePimPage<AdminWarrantyDto>('warranties-options', '/api/admin/warranties?page=1&pageSize=100', open);
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!open) return;
    setSkuCode(variant?.skuRecord?.code ?? variant?.sku ?? ''); setBarcode(variant?.skuRecord?.barcode ?? ''); setTitle(variant?.title ?? ''); setColor(variant?.color ?? ''); setStorage(variant?.storage ?? ''); setRegion(variant?.region ?? ''); setModelNumber(variant?.modelNumber ?? ''); setWarrantyId(variant?.warranty?.id ?? ''); setPriceRials(variant?.skuRecord?.priceRials ?? '0'); setCompareAtPriceRials(variant?.skuRecord?.compareAtPriceRials ?? ''); setCostRials(variant?.skuRecord?.costRials ?? ''); setStatus(variant?.skuRecord?.status ?? 'ACTIVE'); setIsActive(variant?.isActive ?? true); setSortOrder(String(variant?.sortOrder ?? 0));
  }, [open, variant]);
  const save = useMutation({
    mutationFn: () => adminApiRequest<AdminProductVariantDto>(variant ? `/api/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variant.id)}` : `/api/admin/products/${encodeURIComponent(productId)}/variants`, {
      method: variant ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        skuCode: skuCode.trim().toUpperCase(), barcode: barcode.trim() || null, title: title.trim() || null, color: color.trim() || null, storage: storage.trim() || null, region: region.trim() || null, modelNumber: modelNumber.trim() || null, warrantyId: warrantyId || null, priceRials, compareAtPriceRials: compareAtPriceRials || null, costRials: costRials || null, status, isActive, sortOrder: Number(sortOrder) || 0,
        ...(variant ? { version: variant.version } : {}),
      }),
    }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'product', productId] }); await queryClient.invalidateQueries({ queryKey: ['admin', 'pim', 'products'] }); setOpen(false); },
  });
  const allowed = variant ? canUpdate : canCreate;
  if (!allowed) return null;
  return (
    <ModalDialog description="هر تنوع یک SKU قابل فروش با قیمت، وضعیت و مشخصات مستقل دارد." onOpenChange={setOpen} open={open} title={variant ? `ویرایش SKU ${variant.sku}` : 'افزودن تنوع و SKU'} trigger={variant ? <Button size="sm" variant="secondary"><Pencil aria-hidden="true" className="size-3.5" /> ویرایش</Button> : <Button size="sm"><PackagePlus aria-hidden="true" className="size-4" /> تنوع جدید</Button>}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>کد SKU</span><Input dir="ltr" disabled={save.isPending} maxLength={96} onChange={(event) => setSkuCode(event.target.value.toUpperCase())} required value={skuCode} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>بارکد</span><Input dir="ltr" disabled={save.isPending} maxLength={160} onChange={(event) => setBarcode(event.target.value)} value={barcode} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>عنوان تنوع</span><Input disabled={save.isPending} maxLength={200} onChange={(event) => setTitle(event.target.value)} value={title} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>گارانتی</span><Select disabled={save.isPending || warranties.isPending} onChange={(event) => setWarrantyId(event.target.value)} value={warrantyId}><option value="">بدون گارانتی</option>{(warranties.data?.items ?? []).map((warranty) => <option key={warranty.id} value={warranty.id}>{warranty.name} — {warranty.provider}</option>)}</Select></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>رنگ</span><Input disabled={save.isPending} maxLength={80} onChange={(event) => setColor(event.target.value)} value={color} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>حافظه</span><Input disabled={save.isPending} maxLength={80} onChange={(event) => setStorage(event.target.value)} placeholder="256GB" value={storage} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>ریجن</span><Input disabled={save.isPending} maxLength={80} onChange={(event) => setRegion(event.target.value)} value={region} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>Model Number</span><Input dir="ltr" disabled={save.isPending} maxLength={80} onChange={(event) => setModelNumber(event.target.value)} value={modelNumber} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>قیمت (ریال)</span><Input dir="ltr" disabled={save.isPending} min="0" onChange={(event) => setPriceRials(event.target.value)} required type="number" value={priceRials} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>قیمت قبل (ریال)</span><Input dir="ltr" disabled={save.isPending} min="0" onChange={(event) => setCompareAtPriceRials(event.target.value)} type="number" value={compareAtPriceRials} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>بهای تمام‌شده (ریال)</span><Input dir="ltr" disabled={save.isPending} min="0" onChange={(event) => setCostRials(event.target.value)} type="number" value={costRials} /></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>وضعیت SKU</span><Select disabled={save.isPending} onChange={(event) => setStatus(event.target.value as NonNullable<AdminProductVariantDto['skuRecord']>['status'])} value={status}><option value="ACTIVE">فعال</option><option value="INACTIVE">غیرفعال</option><option value="DISCONTINUED">متوقف‌شده</option></Select></label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>ترتیب</span><Input disabled={save.isPending} onChange={(event) => setSortOrder(event.target.value)} type="number" value={sortOrder} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-700"><input checked={isActive} disabled={save.isPending} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" /> تنوع برای فروش فعال باشد</label>
        {warranties.isError ? <Alert title="فهرست گارانتی دریافت نشد" tone="warning">تنوع بدون گارانتی نیز می‌تواند ذخیره شود.</Alert> : null}
        {save.isError ? <Alert title="ذخیرهٔ تنوع انجام نشد" tone="danger">{errorText(save.error)}</Alert> : null}
        <div className="flex justify-end"><Button disabled={save.isPending} type="submit"><Save aria-hidden="true" className="size-4" /> {save.isPending ? 'در حال ذخیره…' : 'ذخیرهٔ تنوع'}</Button></div>
      </form>
    </ModalDialog>
  );
}

function VariantDeleteAction({ canDelete = false, productId, variant }: { canDelete?: boolean; productId: string; variant: AdminProductVariantDto }) {
  const queryClient = useQueryClient();
  const remove = useMutation({ mutationFn: () => adminApiRequest<{ deleted: boolean }>(`/api/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variant.id)}`, { method: 'DELETE' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'product', productId] }) });
  if (!canDelete) return null;
  return <ConfirmDialog confirmLabel="حذف تنوع" destructive description="حذف تنوع پس از کنترل وابستگی‌های موجودی و سفارش در سرویس انجام می‌شود." onConfirm={() => remove.mutate()} title={`حذف ${variant.sku}`} trigger={<Button disabled={remove.isPending} size="sm" variant="danger"><Trash2 aria-hidden="true" className="size-3.5" /> حذف</Button>} />;
}

function ProductVariants({ canCreate = false, canDelete = false, canUpdate = false, product }: ProductPermissions & { product: AdminProductDetailDto }) {
  const columns: readonly DataTableColumn<AdminProductVariantDto>[] = [
    { id: 'sku', header: 'SKU', cell: (variant) => <div><code className="font-semibold text-zinc-900">{variant.skuRecord?.code ?? variant.sku}</code><p className="mt-1 text-xs text-zinc-500">{[variant.storage, variant.color, variant.region].filter(Boolean).join(' · ') || 'بدون گزینهٔ تکمیلی'}</p></div> },
    { id: 'warranty', header: 'گارانتی', cell: (variant) => <span className="text-xs text-zinc-600">{variant.warranty ? `${variant.warranty.name} — ${variant.warranty.provider}` : '—'}</span> },
    { id: 'price', header: 'قیمت', cell: (variant) => <span>{formatRials(variant.skuRecord?.priceRials ?? null)}</span> },
    { id: 'status', header: 'وضعیت', cell: (variant) => <Badge tone={variant.isActive && variant.skuRecord?.status === 'ACTIVE' ? 'success' : 'neutral'}>{variant.isActive ? variant.skuRecord?.status ?? 'بدون SKU' : 'غیرفعال'}</Badge> },
    { id: 'actions', header: 'عملیات', cell: (variant) => <div className="flex flex-wrap gap-2"><VariantEditor canUpdate={canUpdate} productId={product.id} variant={variant} /><VariantDeleteAction canDelete={canDelete} productId={product.id} variant={variant} /></div> },
  ];
  return <Card><CardHeader><div><CardTitle>تنوع‌ها و SKUها</CardTitle><CardDescription>قیمت، گارانتی و گزینه‌های فروش در سطح SKU نگهداری می‌شوند.</CardDescription></div><VariantEditor canCreate={canCreate} productId={product.id} /></CardHeader><CardContent><DataTable columns={columns} emptyMessage="هنوز هیچ تنوع یا SKU برای این محصول ثبت نشده است." getRowKey={(variant) => variant.id} rows={product.variants} /></CardContent></Card>;
}

function SpecificationEditor({ canCreate = false, product }: { canCreate?: boolean; product: AdminProductDetailDto }) {
  const [open, setOpen] = useState(false);
  const [attributeId, setAttributeId] = useState('');
  const [scope, setScope] = useState<'PRODUCT' | 'VARIANT'>('PRODUCT');
  const [variantSkuCode, setVariantSkuCode] = useState('');
  const [displayValue, setDisplayValue] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const attributes = usePimPage<AdminProductAttributeDto>('attributes-options', '/api/admin/attributes?page=1&pageSize=100', open);
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: () => adminApiRequest<AdminProductSpecificationDto>(`/api/admin/products/${encodeURIComponent(product.id)}/specifications`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ attributeId, scope, ...(scope === 'VARIANT' ? { variantSkuCode } : {}), displayValue: displayValue.trim(), unitCode: unitCode.trim() || null, sortOrder: Number(sortOrder) || 0 }) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'product', product.id] }); setOpen(false); setDisplayValue(''); },
  });
  if (!canCreate) return null;
  return <ModalDialog description="برای هر مشخصه یک ویژگی تعریف‌شده انتخاب کنید. مشخصهٔ تنوع فقط به SKU همین محصول وصل می‌شود." onOpenChange={setOpen} open={open} title="افزودن مشخصه" trigger={<Button size="sm" variant="secondary"><Plus aria-hidden="true" className="size-4" /> مشخصه</Button>}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>ویژگی</span><Select disabled={attributes.isPending || save.isPending} onChange={(event) => setAttributeId(event.target.value)} required value={attributeId}><option value="">انتخاب ویژگی</option>{(attributes.data?.items ?? []).map((attribute) => <option key={attribute.id} value={attribute.id}>{attribute.name} ({attribute.valueType})</option>)}</Select></label><label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>سطح</span><Select disabled={save.isPending} onChange={(event) => setScope(event.target.value as 'PRODUCT' | 'VARIANT')} value={scope}><option value="PRODUCT">محصول</option><option value="VARIANT">تنوع</option></Select></label>{scope === 'VARIANT' ? <label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>SKU تنوع</span><Select disabled={save.isPending} onChange={(event) => setVariantSkuCode(event.target.value)} required value={variantSkuCode}><option value="">انتخاب SKU</option>{product.variants.map((variant) => <option key={variant.id} value={variant.sku}>{variant.sku}</option>)}</Select></label> : null}<label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>مقدار نمایشی</span><Input disabled={save.isPending} maxLength={1000} onChange={(event) => setDisplayValue(event.target.value)} required value={displayValue} /></label><label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>واحد</span><Input disabled={save.isPending} maxLength={32} onChange={(event) => setUnitCode(event.target.value)} value={unitCode} /></label><label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>ترتیب</span><Input disabled={save.isPending} onChange={(event) => setSortOrder(event.target.value)} type="number" value={sortOrder} /></label></div>{save.isError ? <Alert title="ثبت مشخصه انجام نشد" tone="danger">{errorText(save.error)}</Alert> : null}<div className="flex justify-end"><Button disabled={save.isPending || attributes.isPending} type="submit"><Save aria-hidden="true" className="size-4" /> ذخیرهٔ مشخصه</Button></div></form></ModalDialog>;
}

function ProductSpecifications({ canCreate = false, product }: { canCreate?: boolean; product: AdminProductDetailDto }) {
  const columns: readonly DataTableColumn<AdminProductSpecificationDto>[] = [
    { id: 'attribute', header: 'ویژگی', cell: (specification) => <div><p className="font-medium text-zinc-900">{specification.attribute.name}</p><code className="mt-1 block text-xs text-zinc-500">{specification.attribute.code}</code></div> },
    { id: 'value', header: 'مقدار', cell: (specification) => <span>{specification.displayValue}{specification.unitCode ? ` ${specification.unitCode}` : ''}</span> },
    { id: 'scope', header: 'سطح', cell: (specification) => <Badge tone={specification.scope === 'VARIANT' ? 'info' : 'neutral'}>{specification.scope === 'VARIANT' ? specification.subjectKey : 'محصول'}</Badge> },
  ];
  return <Card><CardHeader><div><CardTitle>مشخصات فنی</CardTitle><CardDescription>ویژگی‌ها از موتور مشخصات منعطف خوانده می‌شوند، نه از ستون‌های ثابت محصول.</CardDescription></div><SpecificationEditor canCreate={canCreate} product={product} /></CardHeader><CardContent><DataTable columns={columns} emptyMessage="مشخصه‌ای برای این محصول ثبت نشده است." getRowKey={(specification) => specification.id} rows={product.specifications} /></CardContent></Card>;
}

function MediaAssociationEditor({ canCreate = false, product }: { canCreate?: boolean; product: AdminProductDetailDto }) {
  const [open, setOpen] = useState(false);
  const [mediaId, setMediaId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [role, setRole] = useState<'HERO' | 'GALLERY' | 'VIDEO'>('GALLERY');
  const [altText, setAltText] = useState('');
  const [caption, setCaption] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: () => adminApiRequest<AdminProductMediaDto>(`/api/admin/products/${encodeURIComponent(product.id)}/media`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mediaId: mediaId.trim(), variantId: variantId || null, role, altText: altText.trim() || null, caption: caption.trim() || null, sortOrder: Number(sortOrder) || 0 }) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'product', product.id] }); setOpen(false); setMediaId(''); },
  });
  if (!canCreate) return null;
  return <ModalDialog description="ابتدا فایل را در کتابخانهٔ رسانه آپلود کنید، سپس شناسهٔ امن همان فایل را به محصول متصل کنید." onOpenChange={setOpen} open={open} title="اتصال رسانه به محصول" trigger={<Button size="sm" variant="secondary"><ImagePlus aria-hidden="true" className="size-4" /> اتصال رسانه</Button>}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-medium text-zinc-700 sm:col-span-2"><span>شناسهٔ رسانه</span><Input dir="ltr" disabled={save.isPending} onChange={(event) => setMediaId(event.target.value)} placeholder="cuid از کتابخانه رسانه" required value={mediaId} /></label><label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>نقش</span><Select disabled={save.isPending} onChange={(event) => setRole(event.target.value as 'HERO' | 'GALLERY' | 'VIDEO')} value={role}><option value="HERO">تصویر اصلی</option><option value="GALLERY">گالری</option><option value="VIDEO">ویدئو</option></Select></label><label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>تنوع (اختیاری)</span><Select disabled={save.isPending} onChange={(event) => setVariantId(event.target.value)} value={variantId}><option value="">همهٔ محصول</option>{product.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.sku}</option>)}</Select></label><label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>متن جایگزین</span><Input disabled={save.isPending} maxLength={250} onChange={(event) => setAltText(event.target.value)} value={altText} /></label><label className="space-y-1.5 text-sm font-medium text-zinc-700"><span>ترتیب</span><Input disabled={save.isPending} onChange={(event) => setSortOrder(event.target.value)} type="number" value={sortOrder} /></label><label className="space-y-1.5 text-sm font-medium text-zinc-700 sm:col-span-2"><span>توضیح تصویر / ویدئو</span><Input disabled={save.isPending} maxLength={500} onChange={(event) => setCaption(event.target.value)} value={caption} /></label></div>{save.isError ? <Alert title="اتصال رسانه انجام نشد" tone="danger">{errorText(save.error)}</Alert> : null}<div className="flex justify-end"><Button disabled={save.isPending} type="submit"><Save aria-hidden="true" className="size-4" /> اتصال رسانه</Button></div></form></ModalDialog>;
}

function ProductMedia({ canCreate = false, product }: { canCreate?: boolean; product: AdminProductDetailDto }) {
  const columns: readonly DataTableColumn<AdminProductMediaDto>[] = [
    { id: 'file', header: 'رسانه', cell: (media) => <div><p className="font-medium text-zinc-900">{media.media.originalName}</p><p className="mt-1 text-xs text-zinc-500">{media.media.contentType}</p></div> },
    { id: 'role', header: 'نقش', cell: (media) => <Badge tone={media.role === 'HERO' ? 'success' : media.role === 'VIDEO' ? 'info' : 'neutral'}>{media.role === 'HERO' ? 'اصلی' : media.role === 'VIDEO' ? 'ویدئو' : 'گالری'}</Badge> },
    { id: 'alt', header: 'متن جایگزین', cell: (media) => <span className="max-w-48 truncate text-xs text-zinc-600">{media.altText ?? '—'}</span> },
    { id: 'scope', header: 'دامنه', cell: (media) => <span className="text-xs text-zinc-600">{media.variantId ? 'تنوع' : 'محصول'}</span> },
  ];
  return <Card><CardHeader><div><CardTitle>رسانهٔ محصول</CardTitle><CardDescription>فایل‌ها در کتابخانهٔ رسانه ذخیره شده و این بخش صرفاً آن‌ها را به محصول متصل می‌کند.</CardDescription></div><MediaAssociationEditor canCreate={canCreate} product={product} /></CardHeader><CardContent><DataTable columns={columns} emptyMessage="رسانه‌ای به این محصول متصل نشده است." getRowKey={(media) => media.id} rows={product.media} /></CardContent></Card>;
}

function ProductDetail({ permissions, product }: { permissions: ProductPermissions; product: AdminProductDetailDto }) {
  return <div className="space-y-6"><WorkflowActions canPublish={permissions.canPublish ?? false} canUpdate={permissions.canUpdate ?? false} product={product} /><ProductEditorForm canUpdate={permissions.canUpdate ?? false} product={product} /><ProductVariants canCreate={permissions.canCreate ?? false} canDelete={permissions.canDelete ?? false} canUpdate={permissions.canUpdate ?? false} product={product} /><ProductSpecifications canCreate={permissions.canCreate ?? false} product={product} /><ProductMedia canCreate={permissions.canCreate ?? false} product={product} /></div>;
}

export function PimProductEditor({ productId, ...permissions }: ProductPermissions & { productId?: string }) {
  const detail = useAdminResourceQuery<AdminProductDetailDto>('product', productId ? `/api/admin/products/${encodeURIComponent(productId)}` : '/api/admin/products', Boolean(productId));
  if (!productId) return <ProductEditorForm canCreate={permissions.canCreate ?? false} />;
  if (detail.isPending) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-96 w-full" /></div>;
  if (detail.isError || !detail.data) return <EmptyState title="محصول در دسترس نیست" description="محصول پیدا نشد یا سرویس مدیریت PIM فعلاً پاسخ‌گو نیست. هیچ دادهٔ نمایشی جایگزین نشان داده نمی‌شود." />;
  return <ProductDetail permissions={permissions} product={detail.data} />;
}
