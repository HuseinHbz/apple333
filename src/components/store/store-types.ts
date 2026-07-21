/**
 * Backward-compatible storefront type boundary. New code lives in the
 * feature module; approved legacy components continue importing this file.
 */
export type {
  PublicCategoryPageDto,
  PublicProductComparisonDto,
  PublicProductPageDto,
} from '@/features/storefront/types/storefront';
