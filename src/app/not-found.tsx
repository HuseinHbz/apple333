import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'صفحه یافت نشد',
  robots: { index: false, follow: true },
};

export default function NotFound(){return <main className="p-8"><h1>صفحه یافت نشد</h1><Link href="/">بازگشت به خانه</Link></main>;}
