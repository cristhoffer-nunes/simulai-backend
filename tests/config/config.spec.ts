import { AppConfigService } from '@/config/app-config.service';
import { validateEnv } from '@/config/env.schema';

const base = {
  DATABASE_URL: 'postgresql://u:p@h:5432/dev?schema=simulai_service',
  JWT_PRIVATE_KEY_PATH: 'keys/private.pem',
  JWT_PUBLIC_KEY_PATH: 'keys/public.pem',
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    const env = validateEnv(base);
    expect(env).toEqual(
      expect.objectContaining({
        PORT: 3002,
        PASSWORD_RESET_TOKEN_TTL_SECONDS: 3600,
        FIRST_ACCESS_TOKEN_TTL_SECONDS: 259_200,
      }),
    );
  });

  it('refuses a DATABASE_URL outside simulai_service (protects the shared database)', () => {
    expect(() => validateEnv({ ...base, DATABASE_URL: 'postgresql://u:p@h:5432/dev' })).toThrow(
      /DATABASE_URL: DATABASE_URL must target the simulai_service schema/,
    );
  });
});

describe('blank optional settings', () => {
  it('treats empty strings as not set (blank Portainer variables)', () => {
    const env = validateEnv({
      ...base,
      RESEND_API_KEY: '',
      SEED_ADMIN_EMAIL: '',
      SEED_ADMIN_PASSWORD: '',
      SEED_ADMIN_DISPLAY_NAME: '',
    });
    expect([env.RESEND_API_KEY, env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(() => validateEnv({ ...base, SEED_ADMIN_EMAIL: 'not-an-email' })).toThrow(
      /SEED_ADMIN_EMAIL/,
    );
    expect(validateEnv({ ...base, SEED_ADMIN_EMAIL: 'a@b.co' }).SEED_ADMIN_EMAIL).toBe('a@b.co');
  });
});

describe('AppConfigService', () => {
  const env = validateEnv({
    ...base,
    NODE_ENV: 'production',
    CORS_ORIGIN: 'https://a.com, https://b.com,',
    FRONTEND_URL: 'https://app.simulai.com/',
    RESEND_API_KEY: 're_x',
  });
  const configOf = (values: Record<string, unknown>) =>
    new AppConfigService({ get: (key: string) => values[key] } as never);
  const service = configOf(env);

  it('exposes typed groups', () => {
    expect(service.isProduction).toBe(true);
    expect(service.port).toBe(3002);
    expect(service.databaseUrl).toContain('simulai_service');
    expect(service.jwt).toEqual(
      expect.objectContaining({ privateKeyPath: 'keys/private.pem', accessTokenTtlSeconds: 900 }),
    );
    expect(service.corsOrigins).toEqual(['https://a.com', 'https://b.com']);
    expect(service.loginRateLimit).toEqual({ maxAttempts: 5, windowSeconds: 900 });
    expect(service.refreshRateLimit).toEqual({ maxAttempts: 120, windowSeconds: 900 });
    expect(service.forgotPasswordRateLimit).toEqual({ maxAttempts: 3, windowSeconds: 3600 });
    expect(service.passwordReset).toEqual({
      recoveryTtlSeconds: 3600,
      firstAccessTtlSeconds: 259_200,
    });
    expect(service.frontendUrl).toBe('https://app.simulai.com');
    expect(service.email).toEqual({
      resendApiKey: 're_x',
      fromAddress: 'Simulai <no-reply@example.com>',
    });
  });

  it('defaults the Resend key to empty', () => {
    const noKey = configOf(validateEnv(base));
    expect(noKey.email.resendApiKey).toBe('');
  });
});
