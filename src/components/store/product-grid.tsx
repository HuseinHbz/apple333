import { StoreProductCard } from '@/components/store/store-product-card';
import type { PublicProductCardDto } from '@/modules/catalog/types';

export function ProductGrid({ products }: { products: readonly PublicProductCardDto[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => <StoreProductCard key={product.id} product={product} />)}
    </div>
  );
}
