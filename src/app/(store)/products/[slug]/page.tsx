import { ProductDetail } from '@/components/store/product-detail';

type ProductPageProps = Readonly<{ params: Promise<{ slug: string }> }>;

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  return <ProductDetail slug={slug} />;
}
