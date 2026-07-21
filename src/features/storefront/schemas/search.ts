import { z } from 'zod';

import { normalizePersianSearchTerm } from '@/features/storefront/services/persian-search';
import type { StorefrontSearchInput } from '@/features/storefront/types/search';
import { catalogPageQuery } from '@/modules/catalog/validators';

/**
 * Phase 05 search accepts the exact Phase 04 catalog filters and requires a
 * non-empty query.  Reusing the existing schema keeps API bounds and price
 * validation consistent without adding a second public API contract.
 */
export const storefrontSearchInputSchema = catalogPageQuery
  .refine((input) => input.query !== undefined, {
    path: ['query'],
    message: 'Search query is required.',
  })
  .transform((input): StorefrontSearchInput => ({
    ...input,
    query: normalizePersianSearchTerm(input.query ?? ''),
  }))
  .refine((input) => input.query.length > 0, {
    path: ['query'],
    message: 'Search query must contain searchable characters.',
  });

export function parseStorefrontSearchInput(input: unknown): StorefrontSearchInput {
  return storefrontSearchInputSchema.parse(input);
}

export type StorefrontSearchInputSchema = z.output<typeof storefrontSearchInputSchema>;
