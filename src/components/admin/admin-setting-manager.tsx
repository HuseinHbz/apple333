'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { History, Pencil, Plus, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { Select } from '@/components/ui/select';
import { adminApiRequest } from '@/modules/admin/api-client';
import type { AdminSettingRow } from '@/modules/admin/types';
import { useAdminResourceQuery } from './admin-resource-query';

type SettingCategory = AdminSettingRow['category'];
type SettingValue = string | number | boolean | null | readonly SettingValue[] | { readonly [key: string]: SettingValue };

type SettingDetail = {
  id: string;
  key: string;
  category: SettingCategory;
  value: SettingValue | null;
  valueRedacted: boolean;
  isSensitive: boolean;
  version: number;
};

type SettingVersion = {
  id: string;
  version: number;
  value: SettingValue | null;
  valueRedacted: boolean;
  changedById: string | null;
  createdAt: string;
};

const categoryOptions: readonly { value: SettingCategory; label: string }[] = [
  { value: 'GENERAL', label: 'عمومی' },
  { value: 'SECURITY', label: 'امنیت' },
  { value: 'NOTIFICATION', label: 'اعلان‌ها' },
  { value: 'STORAGE', label: 'ذخیره‌سازی' },
  { value: 'APPLICATION', label: 'برنامه' },
];

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'ADMIN_SETTING_MUTATION_FAILED';
}

function jsonText(value: SettingValue | null): string {
  return JSON.stringify(value, null, 2);
}

function SettingEditor({ setting, canUpdate }: { setting?: AdminSettingRow; canUpdate: boolean }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(setting?.key ?? '');
  const [category, setCategory] = useState<SettingCategory>(setting?.category ?? 'GENERAL');
  const [sensitive, setSensitive] = useState(setting?.isSensitive ?? false);
  const [valueText, setValueText] = useState('null');
  const [parseError, setParseError] = useState<string | null>(null);
  const settings = useAdminResourceQuery<readonly SettingDetail[]>('settings', '/api/admin/settings', open);
  const queryClient = useQueryClient();
  const router = useRouter();
  const detail = settings.data?.find((candidate) => candidate.key === setting?.key);

  useEffect(() => {
    if (!open) return;
    setKey(setting?.key ?? '');
    setCategory(detail?.category ?? setting?.category ?? 'GENERAL');
    setSensitive(detail?.isSensitive ?? setting?.isSensitive ?? false);
    setValueText(detail?.valueRedacted ? '' : jsonText(detail?.value ?? null));
    setParseError(null);
  }, [detail?.category, detail?.isSensitive, detail?.value, detail?.valueRedacted, open, setting?.category, setting?.isSensitive, setting?.key]);

  const save = useMutation({
    mutationFn: async () => {
      let value: SettingValue;
      try {
        value = JSON.parse(valueText) as SettingValue;
        setParseError(null);
      } catch {
        setParseError('مقدار باید JSON معتبر باشد.');
        throw new Error('INVALID_SETTING_JSON');
      }
      return adminApiRequest<SettingDetail>('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key: key.trim(),
          category,
          value,
          isSensitive: sensitive,
          expectedVersion: setting?.version ?? 0,
        }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      router.refresh();
      setOpen(false);
    },
  });

  if (!canUpdate) return null;
  const trigger = setting
    ? <Button size="sm" variant="secondary"><Pencil className="size-3.5" aria-hidden="true" /> ویرایش</Button>
    : <Button><Plus className="size-4" aria-hidden="true" /> تنظیم جدید</Button>;

  return (
    <ModalDialog
      description="هر ذخیره با نسخهٔ مورد انتظار و رویداد ممیزی انجام می‌شود؛ مقدارهای حساس هرگز دوباره نمایش داده نمی‌شوند."
      onOpenChange={setOpen}
      open={open}
      title={setting ? `ویرایش ${setting.key}` : 'ایجاد تنظیم جدید'}
      trigger={trigger}
    >
      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-zinc-700">
            <span>کلید</span>
            <Input disabled={Boolean(setting) || save.isPending} maxLength={160} onChange={(event) => setKey(event.target.value)} placeholder="general.site-name" required value={key} />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700">
            <span>دسته</span>
            <Select disabled={save.isPending} onChange={(event) => setCategory(event.target.value as SettingCategory)} value={category}>
              {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </label>
        </div>
        {detail?.valueRedacted ? <Alert title="مقدار قبلی محرمانه است" tone="warning">برای جایگزینی آن، مقدار JSON جدید وارد کنید. مقدار قبلی در UI یا پاسخ API قابل بازیابی نیست.</Alert> : null}
        <label className="block space-y-1.5 text-sm font-medium text-zinc-700">
          <span>مقدار JSON</span>
          <textarea className="min-h-44 w-full rounded-xl border border-zinc-200 p-3 font-mono text-xs outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100" disabled={save.isPending} onChange={(event) => setValueText(event.target.value)} required value={valueText} />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700"><input checked={sensitive} disabled={save.isPending} onChange={(event) => setSensitive(event.target.checked)} type="checkbox" /> مقدار حساس است و در پاسخ‌ها redact شود</label>
        {parseError ? <Alert title="JSON نامعتبر است" tone="danger">{parseError}</Alert> : null}
        {save.isError ? <Alert title="ذخیرهٔ تنظیم انجام نشد" tone="danger">{errorText(save.error)}</Alert> : null}
        <div className="flex justify-end"><Button disabled={save.isPending || settings.isPending} type="submit"><Save className="size-4" aria-hidden="true" /> {save.isPending ? 'در حال ذخیره…' : 'ذخیرهٔ تنظیم'}</Button></div>
      </form>
    </ModalDialog>
  );
}

function SettingHistory({ setting }: { setting: AdminSettingRow }) {
  const [open, setOpen] = useState(false);
  const versions = useAdminResourceQuery<readonly SettingVersion[]>('setting-versions', `/api/admin/settings/${encodeURIComponent(setting.key)}/versions`, open);
  return (
    <ModalDialog
      description="نسخه‌ها فقط خواندنی هستند و برای مقدارهای حساس redact می‌شوند."
      onOpenChange={setOpen}
      open={open}
      title={`تاریخچهٔ ${setting.key}`}
      trigger={<Button size="sm" variant="ghost"><History className="size-3.5" aria-hidden="true" /> نسخه‌ها</Button>}
    >
      {versions.isPending ? <p className="text-sm text-zinc-500">در حال دریافت تاریخچه…</p> : null}
      {versions.isError ? <Alert title="تاریخچه دریافت نشد" tone="danger">دسترسی یا اتصال سرویس را بررسی کنید.</Alert> : null}
      <ol className="space-y-3">
        {versions.data?.map((version) => (
          <li className="rounded-xl border border-zinc-200 p-3" key={version.id}>
            <div className="flex items-center justify-between gap-3"><Badge tone="info">v{version.version}</Badge><time className="text-xs text-zinc-500" dateTime={version.createdAt}>{new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(version.createdAt))}</time></div>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700">{version.valueRedacted ? 'REDACTED' : jsonText(version.value)}</pre>
          </li>
        ))}
      </ol>
    </ModalDialog>
  );
}

export function AdminSettingCreateAction({ canUpdate }: { canUpdate: boolean }) {
  return <SettingEditor canUpdate={canUpdate} />;
}

export function AdminSettingRowActions({ canUpdate, setting }: { setting: AdminSettingRow; canUpdate: boolean }) {
  return <div className="flex flex-wrap gap-2"><SettingEditor canUpdate={canUpdate} setting={setting} /><SettingHistory setting={setting} /></div>;
}
