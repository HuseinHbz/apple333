'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Play, Upload } from 'lucide-react';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { adminApiRequest } from '@/modules/admin/api-client';
import { parsePimCsv, type CsvImportRow } from '@/modules/pim/csv';
import type { AdminProductImportDto, ProductImportPreviewDto } from '@/modules/pim/types';
import { usePimPage } from './pim-resource-query';
import { errorText, formatPimDate } from './pim-utils';

async function checksum(value: string): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) return undefined;
  const bytes = new TextEncoder().encode(value);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function PimProductImportManager({
  canApply = false,
  canCreate = false,
  canRead = false,
}: {
  canApply?: boolean;
  canCreate?: boolean;
  canRead?: boolean;
}) {
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<readonly CsvImportRow[]>([]);
  const [sourceText, setSourceText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProductImportPreviewDto | null>(null);
  const batches = usePimPage<AdminProductImportDto>('product-imports', '/api/admin/product-imports?page=1&pageSize=25', canRead);

  const stage = useMutation({
    mutationFn: async () => {
      const sourceChecksum = await checksum(sourceText);
      return adminApiRequest<ProductImportPreviewDto>('/api/admin/product-imports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          format: 'CSV',
          originalFileName: fileName ?? 'products.csv',
          ...(sourceChecksum === undefined ? {} : { sourceChecksum }),
          rows: rows.map((data, index) => ({ rowNumber: index + 1, data })),
        }),
      });
    },
    onSuccess: async (result) => {
      setPreview(result);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'pim', 'product-imports'] });
    },
  });

  const apply = useMutation({
    mutationFn: (id: string) => adminApiRequest<ProductImportPreviewDto>(`/api/admin/product-imports/${encodeURIComponent(id)}/apply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
    onSuccess: async (result) => {
      setPreview(result);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'pim', 'product-imports'] });
    },
  });

  async function selectFile(file: File | undefined): Promise<void> {
    setPreview(null);
    setParseError(null);
    if (!file) return;
    if (!file.name.toLocaleLowerCase('en-US').endsWith('.csv')) {
      setRows([]);
      setFileName(null);
      setSourceText('');
      setParseError('در این انتشار فقط CSV به‌صورت مستقیم پردازش می‌شود. ورودی XLSX باید ابتدا از مسیر رسانهٔ تأییدشده به ردیف‌های مرحله‌بندی‌شده تبدیل شود.');
      return;
    }
    try {
      const text = await file.text();
      const parsed = parsePimCsv(text);
      if (parsed.length === 0) throw new Error('CSV_EMPTY');
      setRows(parsed);
      setFileName(file.name);
      setSourceText(text);
    } catch (error) {
      setRows([]);
      setFileName(null);
      setSourceText('');
      setParseError(error instanceof Error ? error.message : 'CSV_INVALID');
    }
  }

  return (
    <div className="space-y-6">
      {canCreate ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>مرحله‌بندی ورود محصول</CardTitle>
              <CardDescription>CSV ابتدا در مرورگر به دادهٔ متنی بی‌اثر تبدیل و سپس برای اعتبارسنجی سمت سرور ارسال می‌شود؛ هیچ سطری پیش از تأیید وارد کاتالوگ نمی‌شود.</CardDescription>
            </div>
            <FileSpreadsheet aria-hidden="true" className="size-5 text-zinc-500" />
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-2 text-sm font-medium text-zinc-700">
              <span>فایل CSV (حداکثر ۵٬۰۰۰ ردیف)</span>
              <input accept=".csv,text/csv" className="block w-full rounded-xl border border-zinc-200 bg-white p-2 text-sm" onChange={(event) => void selectFile(event.target.files?.[0])} type="file" />
            </label>
            {fileName ? <p className="text-sm text-zinc-600">{fileName}: {new Intl.NumberFormat('fa-IR').format(rows.length)} ردیف آمادهٔ اعتبارسنجی</p> : null}
            {parseError ? <Alert title="فایل قابل مرحله‌بندی نیست" tone="danger">{parseError}</Alert> : null}
            {stage.isError ? <Alert title="پیش‌نمایش ورود انجام نشد" tone="danger">{errorText(stage.error)}</Alert> : null}
            <Button disabled={rows.length === 0 || stage.isPending} onClick={() => stage.mutate()}>
              <Upload aria-hidden="true" className="size-4" />
              {stage.isPending ? 'در حال اعتبارسنجی…' : 'ایجاد پیش‌نمایش امن'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {preview ? (
        <Card>
          <CardHeader><div><CardTitle>نتیجهٔ پیش‌نمایش</CardTitle><CardDescription>شناسهٔ batch: {preview.id}</CardDescription></div></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3 text-sm"><p>کل: {preview.totalRows}</p><p>معتبر: {preview.validRows}</p><p>خطادار: {preview.failedRows}</p></div>
            {preview.errors.length > 0 ? <Alert title="ردیف‌های دارای خطا" tone="warning">{preview.errors.slice(0, 10).map((error) => `ردیف ${error.rowNumber}: ${error.messages.join('، ')}`).join('\n')}</Alert> : null}
            {canApply && preview.status === 'READY' ? <Button disabled={apply.isPending} onClick={() => apply.mutate(preview.id)}><Play aria-hidden="true" className="size-4" />{apply.isPending ? 'در حال اعمال…' : 'اعمال batch تأییدشده'}</Button> : null}
            {apply.isError ? <Alert title="اعمال batch انجام نشد" tone="danger">{errorText(apply.error)}</Alert> : null}
          </CardContent>
        </Card>
      ) : null}

      {canRead ? (
        <Card>
          <CardHeader><div><CardTitle>batchهای اخیر</CardTitle><CardDescription>ثبت وضعیت و شمارش ردیف‌ها برای ردگیری ممیزی.</CardDescription></div></CardHeader>
          <CardContent>
            {batches.isPending ? <p className="text-sm text-zinc-500">در حال دریافت…</p> : null}
            {batches.isError ? <Alert title="فهرست batchها دریافت نشد" tone="warning">{errorText(batches.error)}</Alert> : null}
            {batches.data ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b text-right text-zinc-500"><tr><th className="p-2">فایل</th><th className="p-2">وضعیت</th><th className="p-2">ردیف‌ها</th><th className="p-2">زمان</th></tr></thead><tbody>{batches.data.items.map((batch) => <tr className="border-b border-zinc-100" key={batch.id}><td className="p-2">{batch.originalFileName}</td><td className="p-2">{batch.status}</td><td className="p-2">{batch.validRows}/{batch.totalRows}</td><td className="p-2"><time dateTime={batch.createdAt}>{formatPimDate(batch.createdAt)}</time></td></tr>)}</tbody></table></div> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
