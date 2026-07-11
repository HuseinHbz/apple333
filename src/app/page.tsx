import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl p-10">
      <p className="text-xs tracking-widest text-slate-500">APPLE333 ENTERPRISE</p>
      <h1 className="mt-3 text-4xl font-bold">Enterprise foundation is ready for the Next.js migration.</h1>
      <p className="mt-4 max-w-2xl text-slate-600">
        The legacy static and Python runtime has been retired from this branch. Storefront modules will be introduced as typed App Router routes.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="inline-block rounded bg-black px-4 py-3 text-white" href="/api/health">Health check</Link>
        <Link className="inline-block rounded border border-slate-300 px-4 py-3 text-slate-800" href="/account/login">Admin sign in</Link>
      </div>
    </main>
  );
}
