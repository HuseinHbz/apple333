import { Activity, CircleAlert, CircleCheck, CircleDashed, CircleX, Database, HardDrive, Server } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminDashboardData, AdminDataState, AdminMetric, AdminSystemStatus, SystemHealth } from '@/modules/admin/types';

const metricOrder: readonly AdminMetric['id'][] = ['users', 'orders', 'revenue', 'products'];

const metricLabels: Record<AdminMetric['id'], { label: string; description: string }> = {
  users: { label: 'کاربران', description: 'ثبت‌شده در سامانه' },
  orders: { label: 'سفارش‌ها', description: 'ماژول سفارش در فاز بعد' },
  revenue: { label: 'درآمد', description: 'داده مالی در دسترس نیست' },
  products: { label: 'محصولات', description: 'کاتالوگ در فاز بعد' }
};

const statusPresentation: Record<SystemHealth, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral'; Icon: typeof CircleCheck }> = {
  healthy: { label: 'سالم', tone: 'success', Icon: CircleCheck },
  degraded: { label: 'ناپایدار', tone: 'warning', Icon: CircleAlert },
  unavailable: { label: 'غیردردسترس', tone: 'danger', Icon: CircleX },
  unknown: { label: 'بررسی‌نشده', tone: 'neutral', Icon: CircleDashed }
};

function formatMetric(metric: AdminMetric | undefined): string {
  if (!metric || metric.value === null) return '—';
  if (metric.format === 'currency') return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(metric.value);
  return new Intl.NumberFormat('fa-IR').format(metric.value);
}

function systemIcon(id: AdminSystemStatus['id']) {
  if (id === 'server') return Server;
  if (id === 'database') return Database;
  return HardDrive;
}

function DashboardLoading() {
  return (
    <div className="space-y-6" aria-label="در حال بارگذاری داشبورد">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricOrder.map((metric) => <Skeleton className="h-[8.5rem]" key={metric} />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-5">
        <Skeleton className="h-72 xl:col-span-3" />
        <Skeleton className="h-72 xl:col-span-2" />
      </div>
    </div>
  );
}

export function AdminDashboard({ state }: { state: AdminDataState<AdminDashboardData> }) {
  if (state.kind === 'loading') return <DashboardLoading />;
  if (state.kind === 'error') return <EmptyState icon={CircleAlert} title="داشبورد بارگذاری نشد" description={state.message} />;
  if (state.kind === 'unavailable') {
    return (
      <EmptyState
        icon={Activity}
        title="داشبورد برای دادهٔ واقعی آماده است"
        description={state.reason ?? 'پس از اتصال سرویس‌های مدیریت، فقط شاخص‌های واقعی کاربران، سفارش‌ها، درآمد و محصولات نمایش داده می‌شوند.'}
      />
    );
  }
  if (state.kind === 'empty') return <EmptyState icon={Activity} title="داده‌ای برای داشبورد وجود ندارد" description="با آغاز فعالیت سامانه، شاخص‌ها و رویدادهای واقعی اینجا دیده می‌شوند." />;

  const metrics = new Map(state.data.metrics.map((metric) => [metric.id, metric]));

  return (
    <div className="space-y-6">
      <section aria-label="نمای کلی کسب‌وکار" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricOrder.map((metricId) => {
          const metric = metrics.get(metricId);
          const definition = metricLabels[metricId];
          return (
            <Card key={metricId}>
              <CardContent>
                <p className="text-sm font-medium text-zinc-500">{metric?.label ?? definition.label}</p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-zinc-950">{formatMetric(metric)}</p>
                <p className="mt-2 text-xs text-zinc-500">{metric?.description ?? definition.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>وضعیت سرویس‌ها</CardTitle>
              <CardDescription>وضعیت لحظه‌ای سرویس‌های زیرساختی بدون پنهان‌سازی خطا</CardDescription>
            </div>
            <Badge tone="info">پایش</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {state.data.system.length ? state.data.system.map((service) => {
              const presentation = statusPresentation[service.status];
              const Icon = systemIcon(service.id);
              const StatusIcon = presentation.Icon;
              return (
                <div className="rounded-xl border border-zinc-200 p-4" key={service.id}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex size-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600"><Icon className="size-4" aria-hidden="true" /></span>
                    <Badge tone={presentation.tone}><StatusIcon className="ml-1 size-3" aria-hidden="true" />{presentation.label}</Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-zinc-900">{service.label}</p>
                  <p className="mt-1 min-h-5 text-xs leading-5 text-zinc-500">{service.detail ?? 'جزئیات بیشتری گزارش نشده است.'}</p>
                </div>
              );
            }) : <p className="col-span-full py-8 text-center text-sm text-zinc-500">هنوز هیچ وضعیت سرویسی گزارش نشده است.</p>}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>آخرین رویدادهای ممیزی</CardTitle>
              <CardDescription>فعالیت‌های ثبت‌شده و قابل پیگیری</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {state.data.activities.length ? (
              <ol className="space-y-4">
                {state.data.activities.map((activity) => (
                  <li className="flex gap-3" key={activity.id}>
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-zinc-300" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-800">{activity.action}</p>
                      <p className="mt-1 truncate text-xs text-zinc-500">{activity.actorName ?? 'سیستم'} · {activity.resource}</p>
                      <time className="mt-1 block text-[11px] text-zinc-400" dateTime={activity.createdAt}>{activity.createdAt}</time>
                    </div>
                  </li>
                ))}
              </ol>
            ) : <p className="py-8 text-center text-sm text-zinc-500">رویداد ممیزی قابل نمایشی وجود ندارد.</p>}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
