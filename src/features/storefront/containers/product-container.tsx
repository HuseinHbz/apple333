import { ProductDetail } from '@/components/store/product-detail';

import { StructuredData, productSchemas } from '../components/structured-data';
import { getStorefrontProductSnapshot } from '../services/server-catalog';

export async function ProductContainer({ slug }: { slug: string }) {
  const snapshot = await getStorefrontProductSnapshot(slug);
  if (!snapshot) return null;

  return (
    <>
      <StructuredData data={productSchemas(snapshot.product)} />
      <ProductDetail slug={snapshot.product.slug} initialProduct={snapshot.product} initialRelatedProducts={snapshot.relatedProducts} />
    </>
  );
}
