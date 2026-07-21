import type { PublicCategoryDto, PublicProductCardDto, PublicProductDto } from '@/modules/catalog/types';

/**
 * Public category response shape exposed by `/api/store/categories`.
 *
 * Keeping this type at the storefront boundary prevents consumers from
 * accidentally treating the API envelope's `data` object as an array.
 */
export type PublicCategoryPageDto = Readonly<{
  items: readonly PublicCategoryDto[];
}>;

export type PublicProductPageDto = Readonly<{
  items: readonly PublicProductCardDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}>;

export type PublicProductComparisonDto = Readonly<{
  items: readonly PublicProductDto[];
}>;

export type StorefrontHomeSnapshot = Readonly<{
  categories: PublicCategoryPageDto;
  featuredProducts: PublicProductPageDto;
  newProducts: PublicProductPageDto;
  saleProducts: PublicProductPageDto;
}>;

export type StorefrontProductSnapshot = Readonly<{
  product: PublicProductDto;
  relatedProducts: PublicProductPageDto | null;
}>;
