import { z } from 'zod';

/**
 * Docker Compose deliberately passes optional variables as empty strings when
 * they are not configured. Normalise only those values before validation so an
 * optional integration (S3 or Sentry) does not make the application unready.
 */
const optionalEnvironmentValue = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    schema.optional()
  );

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().min(1).default('Apple333'),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url(),
  REDIS_URL: optionalEnvironmentValue(z.string().url()),
  S3_ENDPOINT: optionalEnvironmentValue(z.string().url()),
  S3_REGION: optionalEnvironmentValue(z.string().min(1)),
  S3_BUCKET: optionalEnvironmentValue(z.string().min(1)),
  S3_ACCESS_KEY: optionalEnvironmentValue(z.string().min(1)),
  S3_SECRET_KEY: optionalEnvironmentValue(z.string().min(1)),
  SENTRY_DSN: optionalEnvironmentValue(z.string().url()),
  SENTRY_ENVIRONMENT: optionalEnvironmentValue(z.string().trim().min(1).max(64)),
  SENTRY_TRACES_SAMPLE_RATE: optionalEnvironmentValue(z.coerce.number().min(0).max(1))
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && !value.REDIS_URL) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['REDIS_URL'],
      message: 'REDIS_URL is required in production.'
    });
  }
});
export type ServerEnv = z.infer<typeof schema>;
export function readServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv { return schema.parse(source); }
