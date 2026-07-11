'use client';

import { useEffect } from 'react';
import { CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Error details are intentionally not rendered; logging is owned by the server boundary.
    console.error('Admin route error', error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <EmptyState
        icon={CircleAlert}
        title="بخش مدیریت بارگذاری نشد"
        description="خطا ثبت شده است. لطفاً دوباره تلاش کنید؛ اگر مشکل ادامه داشت با مدیر سامانه تماس بگیرید."
        action={<Button onClick={reset}>تلاش دوباره</Button>}
      />
    </div>
  );
}
