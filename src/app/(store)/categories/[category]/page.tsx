import type { Metadata } from 'next';

import { CatalogContainer } from '@/features/storefront/containers/catalog-container';
import { storefrontUrl } from '@/features/storefront/services/metadata';

type CategoryPageProps = Readonly<{ params: Promise<{ category: string }> }>;

export const revalidate = 60;

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  return {
    title: 'محصولات اپل',
    alternates: { canonical: storefrontUrl(`/categories/${encodeURIComponent(category)}`) },
  };
}

/** `/products/[category]` conflicts with the established `/products/[slug]` route. */
export default async function CategoryCatalogPage({ params }: CategoryPageProps) {
  const { category } = await params;
  return <CatalogContainer searchParams={{ category }} />;
}
