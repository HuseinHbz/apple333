import type { Metadata } from 'next';

import { AdminQueryProvider } from '@/components/providers/admin-query-provider';

import './globals.css';

export const metadata: Metadata = {
  title: 'Apple333 Enterprise',
  description: 'Apple333 enterprise platform foundation'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html dir="rtl" lang="fa">
      <body><AdminQueryProvider>{children}</AdminQueryProvider></body>
    </html>
  );
}
