import type { Metadata } from 'next';

import { CatalogContainer } from '@/features/storefront/containers/catalog-container';
import { storefrontUrl } from '@/features/storefront/services/metadata';

type ProductsPageProps = Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>;

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'محصولات اپل',
  alternates: { canonical: storefrontUrl('/products') },
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  return <CatalogContainer searchParams={params} />;
}
