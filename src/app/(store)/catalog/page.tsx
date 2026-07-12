import { CatalogBrowser } from '@/components/store/catalog-browser';

type CatalogPageProps = Readonly<{ searchParams: Promise<{ category?: string }> }>;

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  return <CatalogBrowser initialCategory={params.category ?? ''} />;
}
