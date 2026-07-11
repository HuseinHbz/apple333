import { z } from 'zod';

export const mediaKindInput = z.enum(['IMAGE', 'VIDEO', 'DOCUMENT']);

const mediaMetadataInput = z
  .object({
    alt: z.string().trim().max(250).optional(),
    width: z.number().int().min(0).max(100_000).optional(),
    height: z.number().int().min(0).max(100_000).optional(),
    durationSeconds: z.number().int().min(0).max(86_400).optional(),
    pages: z.number().int().min(0).max(100_000).optional(),
  })
  .strict();

export const createMediaInput = z.object({
  storageKey: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9/_.-]{2,511}$/)
    .refine((key) => !key.includes('..'), 'Storage key must not traverse paths.'),
  originalName: z.string().trim().min(1).max(255),
  contentType: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/)
    .max(120),
  extension: z.string().trim().regex(/^[a-z0-9]{1,12}$/i),
  bytes: z.number().int().positive().max(100 * 1024 * 1024),
  kind: mediaKindInput,
  url: z.string().url().max(2_048).optional(),
  checksum: z.string().trim().regex(/^[A-Fa-f0-9]{64}$/).optional(),
  metadata: mediaMetadataInput.optional(),
});

export const mediaListQuery = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  kind: mediaKindInput.optional(),
  includeDeleted: z.coerce.boolean().default(false),
});

export type CreateMediaInput = z.infer<typeof createMediaInput>;
export type MediaListQuery = z.infer<typeof mediaListQuery>;
