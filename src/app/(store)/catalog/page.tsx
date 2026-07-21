import type { Metadata } from 'next';

import { CatalogContainer } from '@/features/storefront/containers/catalog-container';
import { storefrontUrl } from '@/features/storefront/services/metadata';

type CatalogPageProps = Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>;

export const revalidate = 60;

/** Preserves the legacy path while consolidating its crawl signal on `/products`. */
export const metadata: Metadata = {
  title: 'محصولات اپل',
  alternates: { canonical: storefrontUrl('/products') },
  robots: { index: false, follow: true },
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  return <CatalogContainer searchParams={params} />;
}
