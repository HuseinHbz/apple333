import { z } from 'zod';

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(160);
const price = z.coerce.bigint().nonnegative();
const queryBoolean = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

export const catalogPageQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
  query: z.string().trim().min(1).max(120).optional(),
  category: slug.optional(),
  color: z.string().trim().min(1).max(80).optional(),
  storage: z.string().trim().min(1).max(80).optional(),
  minPriceRials: price.optional(),
  maxPriceRials: price.optional(),
  inStock: queryBoolean.optional(),
  collection: z.enum(['featured', 'new', 'sale']).optional(),
  sort: z.enum(['featured', 'newest', 'price-asc', 'price-desc', 'name']).default('featured'),
}).refine(
  (value) => value.minPriceRials === undefined || value.maxPriceRials === undefined || value.minPriceRials <= value.maxPriceRials,
  { path: ['maxPriceRials'], message: 'حداکثر قیمت باید از حداقل قیمت بیشتر باشد.' },
);

export const productSlugInput = z.object({ slug });

export const compareSlugsQuery = z.object({
  slugs: z.string().trim().min(1).max(800).transform((value) => value.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean)).pipe(z.array(slug).min(2).max(4)),
});

export type CatalogPageQuery = z.output<typeof catalogPageQuery>;
export type ProductSlugInput = z.output<typeof productSlugInput>;
export type CompareSlugsQuery = z.output<typeof compareSlugsQuery>;
