'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

type AdminLoginFormProps = {
  callbackUrl: string;
};

export function AdminLoginForm({ callbackUrl }: AdminLoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const result = await signIn('credentials', {
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
      redirect: false,
      callbackUrl
    });

    setIsSubmitting(false);
    if (!result?.ok) {
      setError('اطلاعات ورود معتبر نیست یا دسترسی مدیریت فعال نشده است.');
      return;
    }

    router.replace(result.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit} noValidate>
      <label className="grid gap-2 text-sm font-medium text-zinc-800">
        ایمیل سازمانی
        <input
          autoComplete="email"
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 outline-none transition focus:border-zinc-950 focus:ring-4 focus:ring-zinc-100"
          name="email"
          required
          type="email"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-zinc-800">
        گذرواژه
        <input
          autoComplete="current-password"
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 outline-none transition focus:border-zinc-950 focus:ring-4 focus:ring-zinc-100"
          minLength={12}
          name="password"
          required
          type="password"
        />
      </label>
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}
      <button
        className="h-11 w-full rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'در حال بررسی…' : 'ورود امن'}
      </button>
    </form>
  );
}
