import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().min(1).default('Apple333'),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  S3_ENDPOINT: z.string().url().optional(), S3_REGION: z.string().min(1).optional(), S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY: z.string().min(1).optional(), S3_SECRET_KEY: z.string().min(1).optional(), SENTRY_DSN: z.string().url().optional()
});
export type ServerEnv = z.infer<typeof schema>;
export function readServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv { return schema.parse(source); }
