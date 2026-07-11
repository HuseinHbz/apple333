'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { adminApiRequest } from '@/modules/admin/api-client';
import type { AdminRoleRow } from '@/modules/admin/types';
import { useAdminResourceQuery } from './admin-resource-query';

type PermissionOption = {
  id: string;
  code: string;
  group: string;
  description: string | null;
};

type RoleDetail = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: readonly PermissionOption[];
};

interface RoleEditorProps {
  role?: Pick<AdminRoleRow, 'id' | 'code' | 'name' | 'description' | 'isSystem'>;
  canCreate?: boolean;
  canUpdate?: boolean;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'ADMIN_ROLE_MUTATION_FAILED';
}

function RoleEditor({ role, canCreate = false, canUpdate = false }: RoleEditorProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(role?.code ?? '');
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [permissionIds, setPermissionIds] = useState<readonly string[]>([]);
  const permissions = useAdminResourceQuery<readonly PermissionOption[]>('permissions', '/api/admin/permissions', open);
  const detail = useAdminResourceQuery<RoleDetail>('role', role ? `/api/admin/roles/${encodeURIComponent(role.id)}` : '/api/admin/roles', Boolean(open && role));
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    setCode(role?.code ?? '');
    setName(role?.name ?? '');
    setDescription(role?.description ?? '');
    setPermissionIds(detail.data?.permissions.map((permission) => permission.id) ?? []);
  }, [detail.data, open, role?.code, role?.description, role?.name]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionOption[]>();
    for (const permission of permissions.data ?? []) {
      groups.set(permission.group, [...(groups.get(permission.group) ?? []), permission]);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [permissions.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
      };
      if (!role) {
        return adminApiRequest<RoleDetail>('/api/admin/roles', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            code: code.trim().toUpperCase(),
            permissionIds,
          }),
        });
      }

      await adminApiRequest<RoleDetail>(`/api/admin/roles/${encodeURIComponent(role.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return adminApiRequest<RoleDetail>(`/api/admin/roles/${encodeURIComponent(role.id)}/permissions`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ permissionIds }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      router.refresh();
      setOpen(false);
    },
  });

  const togglePermission = (permissionId: string) => {
    setPermissionIds((current) => current.includes(permissionId)
      ? current.filter((id) => id !== permissionId)
      : [...current, permissionId]);
  };

  const allowed = role ? canUpdate && !role.isSystem : canCreate;
  if (!allowed) return null;

  const trigger = role
    ? <Button size="sm" variant="secondary"><Pencil className="size-3.5" aria-hidden="true" /> ویرایش</Button>
    : <Button><Plus className="size-4" aria-hidden="true" /> نقش جدید</Button>;

  return (
    <ModalDialog
      description={role ? 'نام، توضیح و مجموعهٔ مجوزهای نقش سفارشی را به‌روز کنید.' : 'نقش‌های جدید فقط به صورت سفارشی ایجاد می‌شوند؛ نقش‌های سیستمی قابل تغییر نیستند.'}
      onOpenChange={setOpen}
      open={open}
      title={role ? `ویرایش نقش ${role.name}` : 'ایجاد نقش جدید'}
      trigger={trigger}
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-zinc-700">
            <span>کد نقش</span>
            <Input disabled={Boolean(role) || save.isPending} maxLength={64} onChange={(event) => setCode(event.target.value)} placeholder="CUSTOM_SUPPORT" required value={code} />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-700">
            <span>نام نمایشی</span>
            <Input disabled={save.isPending} maxLength={120} onChange={(event) => setName(event.target.value)} required value={name} />
          </label>
        </div>
        <label className="block space-y-1.5 text-sm font-medium text-zinc-700">
          <span>توضیح</span>
          <textarea className="min-h-20 w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100" disabled={save.isPending} maxLength={500} onChange={(event) => setDescription(event.target.value)} value={description} />
        </label>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-zinc-800">مجوزها</legend>
          {permissions.isPending ? <p className="text-sm text-zinc-500">در حال دریافت فهرست مجوزها…</p> : null}
          {permissions.isError ? <Alert title="فهرست مجوزها دریافت نشد" tone="danger">برای تغییر نقش، ابتدا دسترسی `permissions.read` را بررسی کنید.</Alert> : null}
          <div className="max-h-64 space-y-4 overflow-y-auto rounded-xl border border-zinc-200 p-3">
            {groupedPermissions.map(([group, entries]) => (
              <section key={group}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{group}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {entries.map((permission) => (
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm hover:bg-zinc-50" key={permission.id}>
                      <input checked={permissionIds.includes(permission.id)} disabled={save.isPending} onChange={() => togglePermission(permission.id)} type="checkbox" />
                      <span><code className="text-xs text-zinc-800">{permission.code}</code>{permission.description ? <span className="mt-0.5 block text-xs text-zinc-500">{permission.description}</span> : null}</span>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </fieldset>
        {save.isError ? <Alert title="ذخیرهٔ نقش انجام نشد" tone="danger">{toErrorMessage(save.error)}</Alert> : null}
        <div className="flex justify-end gap-3">
          <Button disabled={save.isPending || permissions.isPending} type="submit"><ShieldCheck className="size-4" aria-hidden="true" /> {save.isPending ? 'در حال ذخیره…' : 'ذخیرهٔ نقش'}</Button>
        </div>
      </form>
    </ModalDialog>
  );
}

export function AdminRoleCreateAction({ canCreate }: { canCreate: boolean }) {
  return <RoleEditor canCreate={canCreate} />;
}

export function AdminRoleRowActions({
  canDelete,
  canUpdate,
  role,
}: {
  role: Pick<AdminRoleRow, 'id' | 'code' | 'name' | 'description' | 'isSystem'>;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const remove = useMutation({
    mutationFn: () => adminApiRequest<{ deleted: boolean }>(`/api/admin/roles/${encodeURIComponent(role.id)}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      router.refresh();
    },
  });

  if (role.isSystem || (!canUpdate && !canDelete)) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <RoleEditor canUpdate={canUpdate} role={role} />
      {canDelete ? (
        <ConfirmDialog
          confirmLabel="حذف نقش"
          destructive
          description="حذف فقط برای نقش سفارشیِ بدون کاربر مجاز است و یک رویداد ممیزی ثبت می‌شود."
          onConfirm={() => remove.mutate()}
          title={`حذف نقش ${role.name}`}
          trigger={<Button disabled={remove.isPending} size="sm" variant="danger"><Trash2 className="size-3.5" aria-hidden="true" /> حذف</Button>}
        />
      ) : null}
      {remove.isError ? <span className="text-xs text-red-600">{toErrorMessage(remove.error)}</span> : null}
    </div>
  );
}
