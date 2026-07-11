import { z } from 'zod';

export interface JsonInputArray extends Array<JsonInput> {}

export interface JsonInputObject {
  [key: string]: JsonInput;
}

export type JsonInput =
  | string
  | number
  | boolean
  | null
  | JsonInputArray
  | JsonInputObject;

export const jsonValueInput: z.ZodType<JsonInput> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueInput),
    z.record(jsonValueInput),
  ]),
);

export const settingCategoryInput = z.enum([
  'GENERAL',
  'SECURITY',
  'NOTIFICATION',
  'STORAGE',
  'APPLICATION',
]);

export const upsertSettingInput = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
    .max(160),
  category: settingCategoryInput,
  value: jsonValueInput,
  isSensitive: z.boolean().default(false),
  expectedVersion: z.number().int().min(0).optional(),
});

export type UpsertSettingInput = z.infer<typeof upsertSettingInput>;
