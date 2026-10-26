import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3002),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine((url) => url.includes('schema=simulai_service'), {
      message:
        'DATABASE_URL must target the simulai_service schema (?schema=simulai_service) so Prisma keeps its own _prisma_migrations table.',
    }),
  JWT_PRIVATE_KEY_PATH: z.string().min(1),
  JWT_PUBLIC_KEY_PATH: z.string().min(1),

  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(1_209_600),

  CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),

  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),

  // Refresh tokens are 256-bit random values, so this limit is about abuse, not guessing. The web
  // app refreshes on every full page load (the access token lives only in memory), and users behind
  // the same NAT share an IP, so it is set much higher than the login limit.
  REFRESH_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(120),
  REFRESH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),

  // Recovery links are short-lived; first-access (invite) links last longer so a student who
  // opens the email a day later can still set a password.
  PASSWORD_RESET_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3_600),
  FIRST_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(259_200),
  FORGOT_PASSWORD_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(3_600),

  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().min(1).default('Simulai <no-reply@example.com>'),

  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  SEED_ADMIN_DISPLAY_NAME: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}
