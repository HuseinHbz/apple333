import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProductContainer } from '@/features/storefront/containers/product-container';
import { productMetadata } from '@/features/storefront/services/metadata';
import { getStorefrontProduct } from '@/features/storefront/services/server-catalog';

type ProductPageProps = Readonly<{ params: Promise<{ slug: string }> }>;

export const revalidate = 60;

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getStorefrontProduct(slug);
  return product ? productMetadata(product) : { robots: { index: false, follow: false } };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getStorefrontProduct(slug);
  if (!product) notFound();
  return <ProductContainer slug={product.slug} />;
}
