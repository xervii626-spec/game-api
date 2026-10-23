import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1),
  OPERATOR_ID: z.coerce.number().optional(),
  SHARED_KEY: z.string().optional(),
  RGS_IP_WHITELIST: z.string().optional(),
  FRONTEND_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
});

export type EnvVars = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvVars {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  return parsed.data;
}
