import { CompareWorkbench } from '@/components/store/compare-workbench';

type ComparePageProps = Readonly<{ searchParams: Promise<{ slugs?: string }> }>;

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { slugs } = await searchParams;
  const initialSlugs = slugs?.split(',').map((slug) => slug.trim()).filter(Boolean) ?? [];
  return <CompareWorkbench initialSlugs={initialSlugs} />;
}
