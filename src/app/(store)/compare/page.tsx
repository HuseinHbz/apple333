import type { Metadata } from 'next';

import { CompareContainer } from '@/features/storefront/containers/compare-container';
import { storefrontUrl } from '@/features/storefront/services/metadata';

type ComparePageProps = Readonly<{ searchParams: Promise<{ slugs?: string }> }>;

export const metadata: Metadata = {
  title: 'مقایسه محصولات',
  alternates: { canonical: storefrontUrl('/compare') },
  robots: { index: false, follow: true },
};

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { slugs } = await searchParams;
  const initialSlugs = slugs?.split(',').map((slug) => slug.trim()).filter(Boolean) ?? [];
  return <CompareContainer initialSlugs={initialSlugs} />;
}
