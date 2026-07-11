import { Skeleton } from '@/components/ui/skeleton';

export default function AdminLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8" aria-label="در حال بارگذاری مدیریت">
      <Skeleton className="h-8 w-40" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-[8.5rem]" />
        <Skeleton className="h-[8.5rem]" />
        <Skeleton className="h-[8.5rem]" />
        <Skeleton className="h-[8.5rem]" />
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
