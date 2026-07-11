import { AdminLoginForm } from '@/components/auth/admin-login-form';

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl?.startsWith('/admin') ? params.callbackUrl : '/admin';

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-[0_22px_70px_rgba(0,0,0,0.08)] sm:p-9">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Apple333 Enterprise</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">ورود به مدیریت</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">دسترسی فقط برای کاربران فعال پنل مدیریت و بر اساس نقش ثبت‌شده امکان‌پذیر است.</p>
        {params.error ? <p className="mt-5 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">دسترسی درخواستی مجاز نیست.</p> : null}
        <div className="mt-7">
          <AdminLoginForm callbackUrl={callbackUrl} />
        </div>
      </section>
    </main>
  );
}
