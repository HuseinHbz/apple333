import { CatalogBrowser } from '@/components/store/catalog-browser';

type ProductsPageProps = Readonly<{ searchParams: Promise<{ category?: string }> }>;

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  return <CatalogBrowser initialCategory={params.category ?? ''} />;
}
