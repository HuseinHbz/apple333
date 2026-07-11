'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FileText, ImagePlus, KeyRound, Settings2, UserRoundCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import type {
  AdminAuditRow,
  AdminDataState,
  AdminListPageData,
  AdminMediaRow,
  AdminNotificationRow,
  AdminPermissionRow,
  AdminRoleRow,
  AdminSettingRow,
  AdminUserDetail,
  AdminUserRow
} from '@/modules/admin/types';
import { AdminCollectionPage } from './admin-collection-page';
import { AdminMediaUploader } from './admin-media-uploader';
import { AdminPageState } from './admin-page-state';
import { AdminUserActions } from './admin-user-actions';
import { AdminRoleCreateAction, AdminRoleRowActions } from './admin-role-manager';
import { AdminSettingCreateAction, AdminSettingRowActions } from './admin-setting-manager';
import { AdminMediaRowActions } from './admin-media-actions';
import { AdminNotificationRowActions } from './admin-notification-actions';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '—';
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function useAdminListNavigation(path: string) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === '') params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    router.replace(query ? `${path}?${query}` : path);
  };
}

function AdminAuditAdvancedFilters() {
  const searchParams = useSearchParams();
  const navigate = useAdminListNavigation('/admin/audit-logs');
  const [actorId, setActorId] = useState(searchParams.get('actorId') ?? '');
  const [createdFrom, setCreatedFrom] = useState((searchParams.get('createdFrom') ?? '').slice(0, 10));
  const [createdTo, setCreatedTo] = useState((searchParams.get('createdTo') ?? '').slice(0, 10));

  useEffect(() => {
    setActorId(searchParams.get('actorId') ?? '');
    setCreatedFrom((searchParams.get('createdFrom') ?? '').slice(0, 10));
    setCreatedTo((searchParams.get('createdTo') ?? '').slice(0, 10));
  }, [searchParams]);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        navigate({
          actorId: actorId.trim() || undefined,
          createdFrom: createdFrom ? `${createdFrom}T00:00:00.000Z` : undefined,
          createdTo: createdTo ? `${createdTo}T23:59:59.999Z` : undefined,
          page: undefined,
        });
      }}
    >
      <label className="space-y-1 text-xs text-zinc-500"><span>شناسه کاربر</span><Input className="h-8 w-36" onChange={(event) => setActorId(event.target.value)} placeholder="cuid" value={actorId} /></label>
      <label className="space-y-1 text-xs text-zinc-500"><span>از تاریخ</span><Input className="h-8 w-32" onChange={(event) => setCreatedFrom(event.target.value)} type="date" value={createdFrom} /></label>
      <label className="space-y-1 text-xs text-zinc-500"><span>تا تاریخ</span><Input className="h-8 w-32" onChange={(event) => setCreatedTo(event.target.value)} type="date" value={createdTo} /></label>
      <Button size="sm" type="submit" variant="secondary">اعمال</Button>
      <Button onClick={() => { setActorId(''); setCreatedFrom(''); setCreatedTo(''); navigate({ actorId: undefined, createdFrom: undefined, createdTo: undefined, page: undefined }); }} size="sm" type="button" variant="ghost">پاک‌سازی</Button>
    </form>
  );
}

function userStatusTone(status: AdminUserRow['status']): 'success' | 'warning' | 'danger' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'SUSPENDED') return 'danger';
  return 'warning';
}

function userStatusLabel(status: AdminUserRow['status']): string {
  if (status === 'ACTIVE') return 'فعال';
  if (status === 'SUSPENDED') return 'تعلیق‌شده';
  return 'غیرفعال';
}

export function AdminUsersList({ state, canManage = false, canAssignRole = false }: { state: AdminDataState<AdminListPageData<AdminUserRow>>; canManage?: boolean; canAssignRole?: boolean }) {
  const searchParams = useSearchParams();
  const navigate = useAdminListNavigation('/admin/users');
  const searchValue = searchParams.get('query') ?? '';
  const statusValue = searchParams.get('status') ?? '';
  const columns: readonly DataTableColumn<AdminUserRow>[] = [
    {
      id: 'user',
      header: 'کاربر',
      cell: (user) => (
        <div className="min-w-44">
          <Link className="font-semibold text-zinc-900 hover:underline" href={`/admin/users/${encodeURIComponent(user.id)}`}>{user.name ?? 'بدون نام'}</Link>
          <p className="mt-1 text-xs text-zinc-500">{user.email ?? user.mobile ?? 'بدون اطلاعات تماس'}</p>
        </div>
      )
    },
    { id: 'roles', header: 'نقش‌ها', cell: (user) => user.roles.length ? <div className="flex flex-wrap gap-1">{user.roles.map((role) => <Badge key={role}>{role}</Badge>)}</div> : <span className="text-zinc-400">—</span> },
    { id: 'status', header: 'وضعیت', cell: (user) => <Badge tone={userStatusTone(user.status)}>{userStatusLabel(user.status)}</Badge> },
    { id: 'createdAt', header: 'تاریخ ایجاد', cell: (user) => <time dateTime={user.createdAt}>{formatDate(user.createdAt)}</time> },
    { id: 'actions', header: 'عملیات', cell: (user) => <AdminUserActions canAssignRole={canAssignRole} canManage={canManage} status={user.status} userId={user.id} /> }
  ];

  return <AdminCollectionPage columns={columns} emptyDescription="هنوز هیچ کاربری با این فیلتر پیدا نشد." emptyTitle="کاربری وجود ندارد" filterLabel="همه وضعیت‌ها" filterOptions={[{ value: 'ACTIVE', label: 'فعال' }, { value: 'INACTIVE', label: 'غیرفعال' }, { value: 'SUSPENDED', label: 'تعلیق‌شده' }]} filterValue={statusValue} getRowKey={(user) => user.id} onFilterChange={(status) => navigate({ status: status || undefined, page: undefined })} onPageChange={(page) => navigate({ page: String(page) })} onSearchChange={(query) => navigate({ query: query || undefined, page: undefined })} remoteFiltering searchPlaceholder="جست‌وجو با نام، ایمیل یا موبایل" searchValue={searchValue} state={state} />;
}

export function AdminRolesList({
  state,
  canCreate = false,
  canUpdate = false,
  canDelete = false,
}: {
  state: AdminDataState<AdminListPageData<AdminRoleRow>>;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}) {
  const columns: readonly DataTableColumn<AdminRoleRow>[] = [
    { id: 'actions', header: 'عملیات', cell: (role) => <AdminRoleRowActions canDelete={canDelete} canUpdate={canUpdate} role={role} /> },
    { id: 'name', header: 'نقش', cell: (role) => <div><p className="font-semibold text-zinc-900">{role.name}</p><p className="mt-1 font-mono text-xs text-zinc-500">{role.code}</p></div> },
    { id: 'system', header: 'نوع', cell: (role) => <Badge tone={role.isSystem ? 'info' : 'neutral'}>{role.isSystem ? 'سیستمی' : 'سفارشی'}</Badge> },
    { id: 'permissions', header: 'مجوزها', cell: (role) => new Intl.NumberFormat('fa-IR').format(role.permissionCount) },
    { id: 'users', header: 'کاربران', cell: (role) => new Intl.NumberFormat('fa-IR').format(role.userCount) },
    { id: 'updatedAt', header: 'آخرین تغییر', cell: (role) => <time dateTime={role.updatedAt}>{formatDate(role.updatedAt)}</time> }
  ];

  return <AdminCollectionPage columns={columns} emptyDescription="نقشی برای نمایش وجود ندارد." emptyTitle="هیچ نقشی ثبت نشده است" filterLabel="همه نقش‌ها" filterOptions={[{ value: 'system', label: 'سیستمی' }, { value: 'custom', label: 'سفارشی' }]} getRowKey={(role) => role.id} matchesFilter={(role, filter) => filter === 'system' ? role.isSystem : !role.isSystem} matchesSearch={(role, search) => `${role.name} ${role.code} ${role.description ?? ''}`.toLocaleLowerCase('fa-IR').includes(search.toLocaleLowerCase('fa-IR'))} searchPlaceholder="جست‌وجو با نام یا کد نقش" state={state} toolbarTrailing={<AdminRoleCreateAction canCreate={canCreate} />} />;
}

export function AdminPermissionsList({ state }: { state: AdminDataState<AdminListPageData<AdminPermissionRow>> }) {
  const columns: readonly DataTableColumn<AdminPermissionRow>[] = [
    { id: 'code', header: 'مجوز', cell: (permission) => <code className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-800">{permission.code}</code> },
    { id: 'group', header: 'گروه', cell: (permission) => <Badge tone="info">{permission.group}</Badge> },
    { id: 'description', header: 'توضیح', cell: (permission) => <span className="text-zinc-600">{permission.description ?? '—'}</span> },
    { id: 'roles', header: 'نقش‌های دارای مجوز', cell: (permission) => new Intl.NumberFormat('fa-IR').format(permission.roleCount) }
  ];

  return <AdminCollectionPage columns={columns} emptyDescription="هیچ مجوزی با معیارهای فعلی پیدا نشد." emptyTitle="مجوزی وجود ندارد" filterLabel="همه گروه‌ها" getRowKey={(permission) => permission.id} searchPlaceholder="جست‌وجو با فرمت resource.action" state={state} />;
}

const settingCategoryLabels: Record<AdminSettingRow['category'], string> = {
  GENERAL: 'عمومی',
  SECURITY: 'امنیت',
  NOTIFICATION: 'اعلان‌ها',
  STORAGE: 'ذخیره‌سازی',
  APPLICATION: 'برنامه'
};

export function AdminSettingsList({ state, canUpdate = false }: { state: AdminDataState<AdminListPageData<AdminSettingRow>>; canUpdate?: boolean }) {
  const columns: readonly DataTableColumn<AdminSettingRow>[] = [
    { id: 'actions', header: 'عملیات', cell: (setting) => <AdminSettingRowActions canUpdate={canUpdate} setting={setting} /> },
    { id: 'key', header: 'کلید تنظیم', cell: (setting) => <code className="text-xs text-zinc-800">{setting.key}</code> },
    { id: 'category', header: 'دسته', cell: (setting) => <Badge tone="info">{settingCategoryLabels[setting.category]}</Badge> },
    { id: 'version', header: 'نسخه', cell: (setting) => <span>v{new Intl.NumberFormat('fa-IR').format(setting.version)}</span> },
    { id: 'sensitive', header: 'حساسیت', cell: (setting) => <Badge tone={setting.isSensitive ? 'warning' : 'neutral'}>{setting.isSensitive ? 'محرمانه' : 'عادی'}</Badge> },
    { id: 'updatedAt', header: 'آخرین تغییر', cell: (setting) => <time dateTime={setting.updatedAt}>{formatDate(setting.updatedAt)}</time> }
  ];

  return <AdminCollectionPage columns={columns} emptyDescription="تنظیمی در این دسته وجود ندارد." emptyTitle="تنظیمات هنوز پیکربندی نشده‌اند" filterLabel="همه دسته‌ها" filterOptions={[{ value: 'GENERAL', label: 'عمومی' }, { value: 'SECURITY', label: 'امنیت' }, { value: 'NOTIFICATION', label: 'اعلان‌ها' }, { value: 'STORAGE', label: 'ذخیره‌سازی' }, { value: 'APPLICATION', label: 'برنامه' }]} getRowKey={(setting) => setting.id} matchesFilter={(setting, filter) => setting.category === filter} matchesSearch={(setting, search) => setting.key.toLocaleLowerCase('fa-IR').includes(search.toLocaleLowerCase('fa-IR'))} searchPlaceholder="جست‌وجو در تنظیمات" state={state} toolbarTrailing={<AdminSettingCreateAction canUpdate={canUpdate} />} />;
}

export function AdminMediaList({ state, canDelete = false }: { state: AdminDataState<AdminListPageData<AdminMediaRow>>; canDelete?: boolean }) {
  const columns: readonly DataTableColumn<AdminMediaRow>[] = [
    { id: 'actions', header: 'عملیات', cell: (file) => <AdminMediaRowActions canDelete={canDelete} file={file} /> },
    { id: 'metadata', header: 'متادیتا', cell: (file) => <span className="text-xs text-zinc-600">{file.metadata?.alt ?? (file.metadata?.width && file.metadata?.height ? `${file.metadata.width}×${file.metadata.height}` : file.metadata?.pages ? `${file.metadata.pages} صفحه` : '—')}</span> },
    { id: 'file', header: 'فایل', cell: (file) => <div><p className="font-semibold text-zinc-900">{file.originalName}</p><p className="mt-1 text-xs text-zinc-500">{file.contentType}</p></div> },
    { id: 'kind', header: 'نوع', cell: (file) => <Badge tone="info">{file.kind}</Badge> },
    { id: 'bytes', header: 'حجم', cell: (file) => `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(file.bytes / 1024)} کیلوبایت` },
    { id: 'createdAt', header: 'آپلود', cell: (file) => <time dateTime={file.createdAt}>{formatDate(file.createdAt)}</time> }
  ];

  return <AdminCollectionPage columns={columns} emptyDescription="فایل رسانه‌ای برای نمایش وجود ندارد." emptyTitle="کتابخانه رسانه خالی است" filterLabel="همه نوع فایل‌ها" filterOptions={[{ value: 'IMAGE', label: 'تصویر' }, { value: 'VIDEO', label: 'ویدئو' }, { value: 'DOCUMENT', label: 'سند' }]} getRowKey={(file) => file.id} matchesFilter={(file, filter) => file.kind === filter} matchesSearch={(file, search) => `${file.originalName} ${file.contentType} ${file.kind}`.toLocaleLowerCase('fa-IR').includes(search.toLocaleLowerCase('fa-IR'))} searchPlaceholder="جست‌وجو در نام فایل یا نوع" state={state} />;
}

function notificationTone(priority: AdminNotificationRow['priority']): 'neutral' | 'info' | 'warning' | 'danger' {
  if (priority === 'CRITICAL') return 'danger';
  if (priority === 'HIGH') return 'warning';
  if (priority === 'LOW') return 'neutral';
  return 'info';
}

export function AdminNotificationsList({ state, canUpdate = false }: { state: AdminDataState<AdminListPageData<AdminNotificationRow>>; canUpdate?: boolean }) {
  const columns: readonly DataTableColumn<AdminNotificationRow>[] = [
    { id: 'actions', header: 'عملیات', cell: (notification) => <AdminNotificationRowActions canUpdate={canUpdate} notification={notification} /> },
    { id: 'category', header: 'دسته', cell: (notification) => <Badge tone="info">{notification.category}</Badge> },
    { id: 'title', header: 'اعلان', cell: (notification) => <div><p className="font-semibold text-zinc-900">{notification.title}</p><p className="mt-1 max-w-sm truncate text-xs text-zinc-500">{notification.body}</p></div> },
    { id: 'channel', header: 'کانال', cell: (notification) => <Badge>{notification.channel}</Badge> },
    { id: 'priority', header: 'اولویت', cell: (notification) => <Badge tone={notificationTone(notification.priority)}>{notification.priority}</Badge> },
    { id: 'status', header: 'وضعیت', cell: (notification) => <Badge tone={notification.status === 'FAILED' ? 'danger' : notification.status === 'READ' ? 'success' : 'neutral'}>{notification.status}</Badge> },
    { id: 'createdAt', header: 'تاریخ', cell: (notification) => <time dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time> }
  ];

  return <AdminCollectionPage columns={columns} emptyDescription="اعلانی برای نمایش وجود ندارد." emptyTitle="صندوق اعلان خالی است" filterLabel="همه اعلان‌ها" filterOptions={[{ value: 'PENDING', label: 'در انتظار' }, { value: 'SENT', label: 'ارسال‌شده' }, { value: 'READ', label: 'خوانده‌شده' }, { value: 'FAILED', label: 'ناموفق' }]} getRowKey={(notification) => notification.id} matchesFilter={(notification, filter) => notification.status === filter} matchesSearch={(notification, search) => `${notification.title} ${notification.category} ${notification.body}`.toLocaleLowerCase('fa-IR').includes(search.toLocaleLowerCase('fa-IR'))} searchPlaceholder="جست‌وجو در عنوان یا دسته" state={state} />;
}

export function AdminAuditList({ state }: { state: AdminDataState<AdminListPageData<AdminAuditRow>> }) {
  const searchParams = useSearchParams();
  const navigate = useAdminListNavigation('/admin/audit-logs');
  const actionValue = searchParams.get('action') ?? '';
  const resourceValue = searchParams.get('entityType') ?? '';
  const columns: readonly DataTableColumn<AdminAuditRow>[] = [
    { id: 'actor', header: 'کاربر', cell: (audit) => <span>{audit.actorName ?? 'سیستم'}</span> },
    { id: 'action', header: 'عمل', cell: (audit) => <code className="text-xs text-zinc-800">{audit.action}</code> },
    { id: 'resource', header: 'منبع', cell: (audit) => <div><p>{audit.entityType}</p><p className="mt-1 font-mono text-xs text-zinc-500">{audit.entityId ?? '—'}</p></div> },
    { id: 'request', header: 'شناسه درخواست', cell: (audit) => <code className="text-xs text-zinc-500">{audit.requestId}</code> },
    { id: 'ip', header: 'IP', cell: (audit) => <span className="font-mono text-xs">{audit.ipAddress ?? '—'}</span> },
    { id: 'createdAt', header: 'زمان', cell: (audit) => <time dateTime={audit.createdAt}>{formatDate(audit.createdAt)}</time> }
  ];

  return <AdminCollectionPage columns={columns} emptyDescription="رویداد ممیزی با فیلتر فعلی یافت نشد." emptyTitle="رویداد ممیزی وجود ندارد" filterLabel="همه منابع" filterOptions={[{ value: 'User', label: 'کاربر' }, { value: 'Role', label: 'نقش' }, { value: 'SystemSetting', label: 'تنظیمات' }, { value: 'MediaFile', label: 'رسانه' }, { value: 'Notification', label: 'اعلان' }]} filterValue={resourceValue} getRowKey={(audit) => audit.id} onFilterChange={(entityType) => navigate({ entityType: entityType || undefined, page: undefined })} onPageChange={(page) => navigate({ page: String(page) })} onSearchChange={(action) => navigate({ action: action || undefined, page: undefined })} remoteFiltering searchPlaceholder="فیلتر عمل ممیزی" searchValue={actionValue} state={state} toolbarTrailing={<AdminAuditAdvancedFilters />} />;
}

export function AdminUserDetailView({ state }: { state: AdminDataState<AdminUserDetail> }) {
  return (
    <AdminPageState state={state} emptyDescription="شناسه کاربر معتبر نیست یا دسترسی به آن ندارید." emptyTitle="کاربر پیدا نشد">
      {(detail) => (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-1">
            <CardHeader>
              <div><CardTitle>پروفایل کاربر</CardTitle><CardDescription>اطلاعات قابل نمایش مدیریت</CardDescription></div>
              <UserRoundCheck className="size-5 text-zinc-500" aria-hidden="true" />
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div><p className="text-zinc-500">نام</p><p className="mt-1 font-semibold text-zinc-900">{detail.user.name ?? '—'}</p></div>
              <div><p className="text-zinc-500">ایمیل / موبایل</p><p className="mt-1 font-semibold text-zinc-900">{detail.user.email ?? detail.user.mobile ?? '—'}</p></div>
              <div><p className="text-zinc-500">وضعیت</p><div className="mt-1"><Badge tone={userStatusTone(detail.user.status)}>{userStatusLabel(detail.user.status)}</Badge></div></div>
              <div><p className="text-zinc-500">تاریخ ایجاد</p><time className="mt-1 block font-semibold text-zinc-900" dateTime={detail.user.createdAt}>{formatDate(detail.user.createdAt)}</time></div>
            </CardContent>
          </Card>
          <div className="space-y-6 xl:col-span-2">
            <Card>
              <CardHeader><div><CardTitle>نقش‌ها و مجوزهای مؤثر</CardTitle><CardDescription>رمز، OTP و توکن‌ها هرگز در این صفحه نمایش داده نمی‌شوند.</CardDescription></div><KeyRound className="size-5 text-zinc-500" aria-hidden="true" /></CardHeader>
              <CardContent className="space-y-4">
                <div><p className="mb-2 text-xs font-medium text-zinc-500">نقش‌ها</p><div className="flex flex-wrap gap-2">{detail.user.roles.length ? detail.user.roles.map((role) => <Badge key={role} tone="info">{role}</Badge>) : <span className="text-sm text-zinc-400">نقشی تخصیص نیافته است.</span>}</div></div>
                <div><p className="mb-2 text-xs font-medium text-zinc-500">مجوزهای مؤثر</p><div className="flex flex-wrap gap-2">{detail.effectivePermissions.length ? detail.effectivePermissions.map((permission) => <code className="rounded-lg bg-zinc-100 px-2 py-1 text-xs text-zinc-700" key={permission}>{permission}</code>) : <span className="text-sm text-zinc-400">مجوزی تخصیص نیافته است.</span>}</div></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>فعالیت اخیر</CardTitle><CardDescription>رخدادهای ممیزی مرتبط با کاربر</CardDescription></div><FileText className="size-5 text-zinc-500" aria-hidden="true" /></CardHeader>
              <CardContent>{detail.activity.length ? <ol className="space-y-4">{detail.activity.map((activity) => <li className="border-r-2 border-zinc-200 pr-3" key={activity.id}><p className="text-sm font-medium text-zinc-800">{activity.action}</p><p className="mt-1 text-xs text-zinc-500">{activity.resource}</p><time className="mt-1 block text-[11px] text-zinc-400" dateTime={activity.createdAt}>{formatDate(activity.createdAt)}</time></li>)}</ol> : <p className="py-6 text-center text-sm text-zinc-500">فعالیتی ثبت نشده است.</p>}</CardContent>
            </Card>
          </div>
        </div>
      )}
    </AdminPageState>
  );
}

export function AdminPlannedModule({ title, description }: { title: string; description: string }) {
  return <EmptyState icon={Settings2} title={`${title} در فاز جاری فعال نیست`} description={description} />;
}

export function AdminMediaUploadFoundation({ canUpload = false }: { canUpload?: boolean }) {
  return (
    <Card>
      <CardHeader><div><CardTitle>سیاست بارگذاری رسانه</CardTitle><CardDescription>کنترل‌های اعتبارسنجی در سرویس و API اعمال می‌شوند، نه فقط در رابط کاربری.</CardDescription></div><ImagePlus className="size-5 text-zinc-500" aria-hidden="true" /></CardHeader>
      <CardContent className="grid gap-3 text-sm text-zinc-600 sm:grid-cols-3">
        <p className="rounded-xl bg-zinc-50 p-3">نوع MIME و پسوند باید در فهرست مجاز باشند.</p>
        <p className="rounded-xl bg-zinc-50 p-3">حجم فایل پیش از ذخیره‌سازی محدود می‌شود.</p>
        <p className="rounded-xl bg-zinc-50 p-3">فایل اجرایی و محتوای ناامن رد می‌شود.</p>
      </CardContent>
      <CardContent className="pt-0">
        {canUpload ? <AdminMediaUploader /> : <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">برای بارگذاری رسانه به مجوز `media.create` نیاز دارید.</p>}
        <p className="mt-2 text-xs text-zinc-500">آپلود فقط پس از بررسی MIME، پسوند، حجم و magic bytes در سرور ثبت می‌شود.</p>
      </CardContent>
    </Card>
  );
}
