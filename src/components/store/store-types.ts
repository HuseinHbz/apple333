import type { PublicProductCardDto } from '@/modules/catalog/types';
import type { PublicProductDto } from '@/modules/catalog/types';

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
