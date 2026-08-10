import type { Metadata } from 'next';

import { AdminQueryProvider } from '@/components/providers/admin-query-provider';
import { StructuredData, organizationSchema } from '@/features/storefront/components/structured-data';
import { storefrontMetadata } from '@/features/storefront/services/metadata';

import './globals.css';

export const metadata: Metadata = storefrontMetadata();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html dir="rtl" lang="fa">
      <body><StructuredData data={organizationSchema()} /><AdminQueryProvider>{children}</AdminQueryProvider></body>
    </html>
  );
}
